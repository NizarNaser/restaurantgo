<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\DiscountApplication;
use App\Models\DiscountCard;
use App\Models\Employee;
use App\Models\Ingredient;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\RecipeLine;
use App\Models\SemiFinishedGood;
use App\Models\Shift;
use App\Models\StaffCard;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Fills out demo data for every table added across the inventory / staff /
 * discount-card / shift / kitchen-display work — those started out empty —
 * plus tops up a few thin pre-existing tables (menu items, orders) so the
 * new reporting/shift/discount features have something real to show.
 *
 * Scoped to the existing demo tenant (owner@demo.com, tenant_id 1). A no-op
 * if that tenant doesn't exist (e.g. a fresh install that skipped the demo
 * seeders), rather than failing the whole seeding run.
 */
class DemoOperationalDataSeeder extends Seeder
{
    private Tenant $tenant;
    private int $branchId;
    private array $tableIds;
    private User $owner;
    private InventoryService $inventory;

    public function run(): void
    {
        $tenant = Tenant::find(1);
        if (! $tenant) {
            return;
        }

        $this->tenant = $tenant;
        app()->instance('tenant', $tenant);
        $this->branchId = (int) Branch::where('tenant_id', $tenant->id)->value('id');
        $this->tableIds = Table::where('tenant_id', $tenant->id)->pluck('id')->all();
        $this->owner = User::where('tenant_id', $tenant->id)->where('email', 'owner@demo.com')->firstOrFail();
        $this->inventory = new InventoryService();

        $staff = $this->seedStaff();
        $this->seedStaffCards($staff);
        $employees = $this->seedEmployeesAndAttendance($staff);
        $menuItems = $this->seedMenuItems();
        $ingredients = $this->seedIngredients();
        $goods = $this->seedSemiFinishedGoods($ingredients);
        $this->seedRecipes($menuItems, $ingredients, $goods);
        $shifts = $this->seedShifts();
        $orders = $this->seedOrders($menuItems, $staff, $shifts);
        $cards = $this->seedDiscountCards();
        $this->seedDiscountApplications($orders, $cards, $staff);

        unset($employees); // used only to keep attendance seeding self-contained above
    }

    /** @return User[] */
    private function seedStaff(): array
    {
        $roster = [
            ['name' => 'Layla Manager', 'role' => 'manager'],
            ['name' => 'Omar Waiter', 'role' => 'waiter'],
            ['name' => 'Sara Waiter', 'role' => 'waiter'],
            ['name' => 'Karim Bartender', 'role' => 'bartender'],
            ['name' => 'Rana Staff', 'role' => 'staff'],
            ['name' => 'Yousef Staff', 'role' => 'staff'],
            ['name' => 'Kitchen Screen', 'role' => 'kitchen_display'],
        ];

        return collect($roster)->map(function (array $row) {
            $email = Str::slug($row['name']) . '@demo.com';

            $user = User::firstOrCreate(
                ['tenant_id' => $this->tenant->id, 'email' => $email],
                [
                    'branch_id' => $this->branchId,
                    'name'      => $row['name'],
                    'password'  => Hash::make('password'),
                    'is_active' => true,
                ]
            );

            if (! $user->hasRole($row['role'])) {
                $user->syncRoles([$row['role']]);
            }

            return $user;
        })->all();
    }

    /** @param User[] $staff */
    private function seedStaffCards(array $staff): void
    {
        foreach ($staff as $i => $user) {
            if ($user->hasRole('manager')) {
                continue; // managers approve via their own password, not a card
            }

            StaffCard::firstOrCreate(
                ['tenant_id' => $this->tenant->id, 'user_id' => $user->id],
                [
                    'card_identifier' => 'CARD-DEMO-' . str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
                    'access_code'     => (string) random_int(1000, 9999),
                    'is_active'       => true,
                ]
            );
        }
    }

    /** @param User[] $staff */
    private function seedEmployeesAndAttendance(array $staff): array
    {
        $positions = ['Manager', 'Waiter', 'Waiter', 'Bartender', 'Kitchen Staff', 'Kitchen Staff'];
        $employees = [];

        foreach (array_slice($staff, 0, 6) as $i => $user) {
            $employee = Employee::firstOrCreate(
                ['tenant_id' => $this->tenant->id, 'name' => $user->name],
                [
                    'branch_id'   => $this->branchId,
                    'position'    => $positions[$i] ?? 'Staff',
                    'base_salary' => [1800, 1200, 1200, 1300, 1100, 1100][$i] ?? 1000,
                    'currency'    => 'USD',
                    'hire_date'   => now()->subMonths(random_int(2, 18))->toDateString(),
                    'status'      => 'active',
                ]
            );
            $employees[] = $employee;

            if (! $user->employee_id) {
                $user->update(['employee_id' => $employee->id]);
            }

            // ~3 days of check-in/out history per employee.
            for ($d = 3; $d >= 1; $d--) {
                $checkIn = now()->subDays($d)->setTime(9, random_int(0, 30));
                $employee->attendance()->firstOrCreate(
                    ['tenant_id' => $this->tenant->id, 'employee_id' => $employee->id, 'check_in' => $checkIn],
                    [
                        'branch_id' => $this->branchId,
                        'check_out' => $checkIn->copy()->addHours(8)->addMinutes(random_int(0, 45)),
                        'type'      => 'manual',
                        'created_by' => $this->owner->id,
                    ]
                );
            }
        }

        return $employees;
    }

    /** @return MenuItem[] */
    private function seedMenuItems(): array
    {
        // [name, category_id, price]
        $items = [
            ['Grilled Chicken Breast', 1, 18.50],
            ['Classic Beef Burger', 1, 14.00],
            ['Spaghetti Bolognese', 1, 16.00],
            ['Margherita Pizza', 1, 15.00],
            ['Chicken Alfredo Pasta', 1, 17.50],
            ['Garlic Bread', 5, 6.50],
            ['Caesar Salad', 5, 9.00],
            ['Bruschetta', 5, 7.50],
            ['Chocolate Lava Cake', 2, 8.00],
            ['Tiramisu', 2, 7.50],
            ['New York Cheesecake', 2, 7.00],
            ['Iced Tea', 21, 4.00],
            ['Sparkling Water', 21, 3.00],
            ['Espresso', 21, 3.50],
        ];

        return collect($items)->map(function (array $row) {
            [$name, $categoryId, $price] = $row;

            if (! MenuCategory::where('tenant_id', $this->tenant->id)->whereKey($categoryId)->exists()) {
                return null;
            }

            $item = MenuItem::firstOrCreate(
                ['tenant_id' => $this->tenant->id, 'menu_category_id' => $categoryId, 'sku' => Str::slug($name)],
                ['base_price' => $price, 'is_available' => true]
            );

            $item->translations()->firstOrCreate(['locale' => 'en'], ['name' => $name]);
            $item->prices()->firstOrCreate(['currency' => 'USD'], ['price' => $price]);

            return $item;
        })->filter()->values()->all();
    }

    /** @return Ingredient[] */
    private function seedIngredients(): array
    {
        // [name, unit, unit price]
        $rows = [
            ['Tomato', 'gram', 0.006], ['Onion', 'gram', 0.004], ['Garlic', 'gram', 0.012],
            ['Chicken Breast', 'gram', 0.014], ['Beef Mince', 'gram', 0.018], ['Rice', 'gram', 0.003],
            ['Olive Oil', 'gram', 0.010], ['Salt', 'gram', 0.001], ['Black Pepper', 'gram', 0.030],
            ['Flour', 'gram', 0.002], ['Sugar', 'gram', 0.002], ['Butter', 'gram', 0.011],
            ['Mozzarella Cheese', 'gram', 0.016], ['Lettuce', 'gram', 0.005], ['Cucumber', 'gram', 0.004],
            ['Lemon', 'piece', 0.40], ['Spaghetti', 'gram', 0.005], ['Basil', 'gram', 0.025],
            ['Heavy Cream', 'gram', 0.009], ['Potato', 'gram', 0.003],
        ];

        return collect($rows)->map(function (array $row, int $i) {
            [$name, $unit, $price] = $row;

            $ingredient = Ingredient::firstOrCreate(
                ['tenant_id' => $this->tenant->id, 'name' => $name],
                ['unit' => $unit, 'unit_price' => $price, 'is_active' => true]
            );

            if ((float) $ingredient->current_stock <= 0) {
                $quantity = $unit === 'piece' ? random_int(50, 150) : random_int(5000, 20000);
                $this->inventory->recordPurchase(
                    Ingredient::class,
                    $ingredient->id,
                    $quantity,
                    $price,
                    now()->subDays(20 - $i),
                    'Initial stock',
                    $this->owner,
                );
                $ingredient->refresh();
            }

            return $ingredient;
        })->all();
    }

    /** @param Ingredient[] $ingredients @return SemiFinishedGood[] */
    private function seedSemiFinishedGoods(array $ingredients): array
    {
        $byName = collect($ingredients)->keyBy('name');

        // [name, unit, [ [ingredient name, gross qty per unit], ... ]]
        $goods = [
            ['House Tomato Sauce', 'gram', [['Tomato', 0.6], ['Garlic', 0.05], ['Olive Oil', 0.1], ['Basil', 0.02]]],
            ['Garlic Butter', 'gram', [['Butter', 0.85], ['Garlic', 0.15]]],
            ['Burger Patty Mix', 'gram', [['Beef Mince', 0.95], ['Salt', 0.02], ['Black Pepper', 0.02]]],
            ['Salad Dressing', 'gram', [['Olive Oil', 0.7], ['Lemon', 0.02], ['Salt', 0.01]]],
            ['Pizza Dough', 'gram', [['Flour', 0.9], ['Sugar', 0.02], ['Olive Oil', 0.05]]],
            ['Chicken Marinade', 'gram', [['Lemon', 0.05], ['Garlic', 0.1], ['Olive Oil', 0.6], ['Salt', 0.02]]],
        ];

        return collect($goods)->map(function (array $row) use ($byName) {
            [$name, $unit, $recipe] = $row;

            $good = SemiFinishedGood::firstOrCreate(
                ['tenant_id' => $this->tenant->id, 'name' => $name],
                ['unit' => $unit, 'is_active' => true]
            );

            if ($good->ownRecipeLines()->doesntExist()) {
                foreach ($recipe as $sort => [$ingredientName, $qty]) {
                    $ingredient = $byName->get($ingredientName);
                    if (! $ingredient) {
                        continue;
                    }
                    RecipeLine::create([
                        'tenant_id'          => $this->tenant->id,
                        'recipeable_type'    => SemiFinishedGood::class,
                        'recipeable_id'      => $good->id,
                        'componentable_type' => Ingredient::class,
                        'componentable_id'   => $ingredient->id,
                        'gross_quantity'     => $qty,
                        'sort_order'         => $sort,
                    ]);
                }
            }

            if ((float) $good->current_stock <= 0) {
                $this->inventory->produceSemiFinishedGood($good, random_int(500, 2000), $this->owner, 'Initial batch');
                $good->refresh();
            }

            return $good;
        })->all();
    }

    /** @param MenuItem[] $menuItems @param Ingredient[] $ingredients @param SemiFinishedGood[] $goods */
    private function seedRecipes(array $menuItems, array $ingredients, array $goods): void
    {
        $itemsBySku = collect($menuItems)->keyBy('sku');
        $ingredientsByName = collect($ingredients)->keyBy('name');
        $goodsByName = collect($goods)->keyBy('name');

        // [item sku, [ [type('i'|'g'), name, gross qty], ... ]]
        $recipes = [
            'grilled-chicken-breast' => [['i', 'Chicken Breast', 220], ['g', 'Chicken Marinade', 20]],
            'classic-beef-burger'    => [['g', 'Burger Patty Mix', 180], ['i', 'Lettuce', 20]],
            'spaghetti-bolognese'    => [['i', 'Spaghetti', 180], ['i', 'Beef Mince', 150], ['g', 'House Tomato Sauce', 100]],
            'margherita-pizza'       => [['g', 'Pizza Dough', 250], ['g', 'House Tomato Sauce', 90], ['i', 'Mozzarella Cheese', 120]],
            'garlic-bread'           => [['i', 'Flour', 150], ['g', 'Garlic Butter', 40]],
            'caesar-salad'           => [['i', 'Lettuce', 150], ['g', 'Salad Dressing', 40], ['i', 'Mozzarella Cheese', 30]],
        ];

        foreach ($recipes as $sku => $lines) {
            $item = $itemsBySku->get($sku);
            if (! $item || $item->recipeLines()->exists()) {
                continue;
            }

            foreach ($lines as $sort => [$type, $name, $qty]) {
                $component = $type === 'i' ? $ingredientsByName->get($name) : $goodsByName->get($name);
                if (! $component) {
                    continue;
                }
                RecipeLine::create([
                    'tenant_id'          => $this->tenant->id,
                    'recipeable_type'    => MenuItem::class,
                    'recipeable_id'      => $item->id,
                    'componentable_type' => $type === 'i' ? Ingredient::class : SemiFinishedGood::class,
                    'componentable_id'   => $component->id,
                    'gross_quantity'     => $qty,
                    'sort_order'         => $sort,
                ]);
            }
        }
    }

    /** @return Shift[] */
    private function seedShifts(): array
    {
        $shifts = [];
        for ($d = 5; $d >= 1; $d--) {
            $opened = now()->subDays($d)->setTime(10, 0);
            $shifts[] = Shift::firstOrCreate(
                ['tenant_id' => $this->tenant->id, 'branch_id' => $this->branchId, 'opened_at' => $opened],
                [
                    'opened_by_user_id' => $this->owner->id,
                    'closed_by_user_id' => $this->owner->id,
                    'closed_at'         => $opened->copy()->addHours(10),
                    'status'            => 'closed',
                ]
            );
        }

        // Leave no shift open — existing ShiftGate already covers the open-shift flow live.
        return $shifts;
    }

    /** @param MenuItem[] $menuItems @param User[] $staff @param Shift[] $shifts @return Order[] */
    private function seedOrders(array $menuItems, array $staff, array $shifts): array
    {
        $servingStaff = array_values(array_filter($staff, fn (User $u) => $u->hasRole(['waiter', 'bartender', 'staff'])));
        $existing = Order::where('tenant_id', $this->tenant->id)->count();
        $toCreate = max(0, 20 - $existing);
        $orders = [];

        for ($i = 0; $i < $toCreate; $i++) {
            $daysAgo = random_int(0, 5);
            $shift = $shifts[$daysAgo] ?? null;
            $opener = $servingStaff[array_rand($servingStaff)] ?? $this->owner;
            $createdAt = now()->subDays($daysAgo)->setTime(random_int(12, 21), random_int(0, 59));
            $lineCount = random_int(1, 3);
            $picked = collect($menuItems)->random(min($lineCount, count($menuItems)));

            $order = Order::create([
                'tenant_id'         => $this->tenant->id,
                'branch_id'         => $this->branchId,
                'table_id'          => $this->tableIds[array_rand($this->tableIds)],
                'opened_by_user_id' => $opener->id,
                'type'              => 'dine_in',
                'source'            => 'staff',
                'status'            => 'completed',
                'payment_status'    => 'paid',
                'subtotal'          => 0,
                'total'             => 0,
                'currency'          => 'USD',
                'tracking_code'     => Str::upper(Str::random(8)),
                'paid_at'           => $createdAt->copy()->addMinutes(random_int(20, 70)),
                'shift_id'          => $shift?->id,
            ]);

            // created_at/updated_at aren't mass-assignable — set them directly
            // (bypassing $fillable) so seeded orders spread realistically
            // across the last few days instead of all landing on "now".
            $order->timestamps = false;
            $order->created_at = $createdAt;
            $order->save();
            $order->timestamps = true;

            $subtotal = 0;
            foreach ($picked as $item) {
                $quantity = random_int(1, 3);
                $unitPrice = (float) $item->base_price;
                $lineSubtotal = round($unitPrice * $quantity, 2);
                $subtotal += $lineSubtotal;

                $order->items()->create([
                    'menu_item_id'   => $item->id,
                    'name'           => $item->translation('en')?->name ?? $item->sku,
                    'unit_price'     => $unitPrice,
                    'quantity'       => $quantity,
                    'subtotal'       => $lineSubtotal,
                    'kitchen_status' => 'ready',
                    'ready_at'       => $createdAt->copy()->addMinutes(10),
                    'collected_at'   => $createdAt->copy()->addMinutes(15),
                ]);
            }

            $order->update(['subtotal' => $subtotal, 'total' => $subtotal]);
            $orders[] = $order->fresh();
        }

        return array_merge(
            Order::where('tenant_id', $this->tenant->id)->where('status', 'completed')->get()->all(),
            $orders
        );
    }

    /** @return DiscountCard[] */
    private function seedDiscountCards(): array
    {
        $names = [
            'Amina Khalil', 'Hassan Ali', 'Noor Saleh', 'Fadi Haddad', 'Rania Youssef',
            'Tarek Aziz', 'Dina Farouk', 'Samir Nassar', 'Lina Mansour', 'Ziad Kanaan',
            'Maya Abboud', 'Bilal Chami', 'Reem Sabbagh', 'Nour Salame', 'Adel Btaish',
            'Hala Debs', 'Wael Fares', 'Joud Rahal', 'Mira Antar', 'Khaled Jaber',
        ];

        return collect($names)->map(function (string $name, int $i) {
            return DiscountCard::firstOrCreate(
                ['tenant_id' => $this->tenant->id, 'card_number' => 'VIP-' . str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT)],
                [
                    'customer_name'         => $name,
                    'customer_birth_date'   => now()->subYears(random_int(20, 60))->subDays(random_int(0, 365))->toDateString(),
                    'customer_phone'        => '+961 70' . random_int(100000, 999999),
                    'customer_email'        => Str::slug($name) . '@example.com',
                    'discount_percentage'   => [5, 10, 10, 15, 20][array_rand([5, 10, 10, 15, 20])],
                    'accumulated_balance'   => random_int(0, 4) === 0 ? round(random_int(5, 40), 2) : 0,
                    'registered_by_user_id' => $this->owner->id,
                ]
            );
        })->all();
    }

    /** @param Order[] $orders @param DiscountCard[] $cards @param User[] $staff */
    private function seedDiscountApplications(array $orders, array $cards, array $staff): void
    {
        $manager = collect($staff)->first(fn (User $u) => $u->hasRole('manager')) ?? $this->owner;
        $eligibleOrders = collect($orders)->filter(fn (Order $o) => (float) $o->discount_amount === 0.0)->values();

        $count = min(10, $eligibleOrders->count(), count($cards));
        for ($i = 0; $i < $count; $i++) {
            $order = $eligibleOrders[$i];
            $card = $cards[$i];
            $mode = $i % 3 === 0 ? 'accumulate' : 'deduct';
            $amount = round(((float) $order->subtotal) * ((float) $card->discount_percentage) / 100, 2);

            if (DiscountApplication::where('order_id', $order->id)->exists()) {
                continue;
            }

            DiscountApplication::create([
                'tenant_id'             => $this->tenant->id,
                'order_id'              => $order->id,
                'discount_card_id'      => $card->id,
                'requested_by_user_id'  => $order->opened_by_user_id,
                'mode'                  => $mode,
                'discount_percentage'   => $card->discount_percentage,
                'amount'                => $amount,
                'status'                => 'approved',
                'approved_by_user_id'   => $manager->id,
                'approved_at'           => $order->paid_at,
            ]);

            if ($mode === 'deduct') {
                $order->update([
                    'discount_card_id' => $card->id,
                    'discount_amount'  => $amount,
                    'total'            => (float) $order->subtotal - $amount,
                ]);
            } else {
                $card->increment('accumulated_balance', $amount);
            }
        }
    }
}
