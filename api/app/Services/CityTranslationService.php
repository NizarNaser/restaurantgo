<?php

namespace App\Services;

/**
 * Branches store their city as a free-text string the restaurant owner typed
 * once (see Branch::$fillable) — there's no cities table, so the exact same
 * city can read "Kyiv", "Kiev" or "Київ" depending on who typed it, and it
 * never changes with the visitor's chosen site language.
 *
 * This translates the common, well-known cities a RestaurantGo tenant is
 * likely to be in (the Gulf/MENA region, Ukraine, Turkey, and a handful of
 * major world capitals) into whichever of the 12 supported locales the
 * visitor is browsing in. Anything not recognised — a small town, or a
 * spelling not listed below — is returned unchanged rather than guessed at,
 * which is the deliberate, low-risk scope the city dictionary was asked for:
 * common cities only, with the raw string as fallback.
 */
class CityTranslationService
{
    /**
     * canonical key => [locale => localised name]. The English value always
     * doubles as a match alias, plus a few extra common spellings added
     * in ALIASES below (e.g. "kiev" for Kyiv, "makkah" for Mecca).
     */
    private const CITIES = [
        'dubai'        => ['en' => 'Dubai', 'ar' => 'دبي', 'fr' => 'Dubaï', 'de' => 'Dubai', 'es' => 'Dubái', 'it' => 'Dubai', 'pt' => 'Dubai', 'ru' => 'Дубай', 'uk' => 'Дубай', 'tr' => 'Dubai', 'zh' => '迪拜', 'ja' => 'ドバイ'],
        'abu_dhabi'    => ['en' => 'Abu Dhabi', 'ar' => 'أبوظبي', 'fr' => 'Abou Dabi', 'de' => 'Abu Dhabi', 'es' => 'Abu Dabi', 'it' => 'Abu Dhabi', 'pt' => 'Abu Dhabi', 'ru' => 'Абу-Даби', 'uk' => 'Абу-Дабі', 'tr' => 'Abu Dabi', 'zh' => '阿布扎比', 'ja' => 'アブダビ'],
        'sharjah'      => ['en' => 'Sharjah', 'ar' => 'الشارقة', 'fr' => 'Charjah', 'de' => 'Sharjah', 'es' => 'Sharjah', 'it' => 'Sharja', 'pt' => 'Sharjah', 'ru' => 'Шарджа', 'uk' => 'Шарджа', 'tr' => 'Şarja', 'zh' => '沙迦', 'ja' => 'シャールジャ'],
        'riyadh'       => ['en' => 'Riyadh', 'ar' => 'الرياض', 'fr' => 'Riyad', 'de' => 'Riad', 'es' => 'Riad', 'it' => 'Riad', 'pt' => 'Riade', 'ru' => 'Эр-Рияд', 'uk' => 'Ер-Ріяд', 'tr' => 'Riyad', 'zh' => '利雅得', 'ja' => 'リヤド'],
        'jeddah'       => ['en' => 'Jeddah', 'ar' => 'جدة', 'fr' => 'Djeddah', 'de' => 'Dschidda', 'es' => 'Yeda', 'it' => 'Gedda', 'pt' => 'Jidá', 'ru' => 'Джидда', 'uk' => 'Джидда', 'tr' => 'Cidde', 'zh' => '吉达', 'ja' => 'ジェッダ'],
        'mecca'        => ['en' => 'Mecca', 'ar' => 'مكة المكرمة', 'fr' => 'La Mecque', 'de' => 'Mekka', 'es' => 'La Meca', 'it' => 'La Mecca', 'pt' => 'Meca', 'ru' => 'Мекка', 'uk' => 'Мекка', 'tr' => 'Mekke', 'zh' => '麦加', 'ja' => 'メッカ'],
        'medina'       => ['en' => 'Medina', 'ar' => 'المدينة المنورة', 'fr' => 'Médine', 'de' => 'Medina', 'es' => 'Medina', 'it' => 'Medina', 'pt' => 'Medina', 'ru' => 'Медина', 'uk' => 'Медина', 'tr' => 'Medine', 'zh' => '麦地那', 'ja' => 'メディナ'],
        'doha'         => ['en' => 'Doha', 'ar' => 'الدوحة', 'fr' => 'Doha', 'de' => 'Doha', 'es' => 'Doha', 'it' => 'Doha', 'pt' => 'Doha', 'ru' => 'Доха', 'uk' => 'Доха', 'tr' => 'Doha', 'zh' => '多哈', 'ja' => 'ドーハ'],
        'kuwait_city'  => ['en' => 'Kuwait City', 'ar' => 'مدينة الكويت', 'fr' => 'Koweït', 'de' => 'Kuwait-Stadt', 'es' => 'Ciudad de Kuwait', 'it' => 'Città del Kuwait', 'pt' => 'Cidade do Kuwait', 'ru' => 'Эль-Кувейт', 'uk' => 'Ель-Кувейт', 'tr' => 'Kuveyt Şehri', 'zh' => '科威特城', 'ja' => 'クウェートシティ'],
        'manama'       => ['en' => 'Manama', 'ar' => 'المنامة', 'fr' => 'Manama', 'de' => 'Manama', 'es' => 'Manama', 'it' => 'Manama', 'pt' => 'Manama', 'ru' => 'Манама', 'uk' => 'Манама', 'tr' => 'Manama', 'zh' => '麦纳麦', 'ja' => 'マナーマ'],
        'muscat'       => ['en' => 'Muscat', 'ar' => 'مسقط', 'fr' => 'Mascate', 'de' => 'Maskat', 'es' => 'Mascate', 'it' => 'Mascate', 'pt' => 'Mascate', 'ru' => 'Маскат', 'uk' => 'Маскат', 'tr' => 'Maskat', 'zh' => '马斯喀特', 'ja' => 'マスカット'],
        'cairo'        => ['en' => 'Cairo', 'ar' => 'القاهرة', 'fr' => 'Le Caire', 'de' => 'Kairo', 'es' => 'El Cairo', 'it' => 'Il Cairo', 'pt' => 'Cairo', 'ru' => 'Каир', 'uk' => 'Каїр', 'tr' => 'Kahire', 'zh' => '开罗', 'ja' => 'カイロ'],
        'alexandria'   => ['en' => 'Alexandria', 'ar' => 'الإسكندرية', 'fr' => 'Alexandrie', 'de' => 'Alexandria', 'es' => 'Alejandría', 'it' => "Alessandria d'Egitto", 'pt' => 'Alexandria', 'ru' => 'Александрия', 'uk' => 'Александрія', 'tr' => 'İskenderiye', 'zh' => '亚历山大', 'ja' => 'アレクサンドリア'],
        'beirut'       => ['en' => 'Beirut', 'ar' => 'بيروت', 'fr' => 'Beyrouth', 'de' => 'Beirut', 'es' => 'Beirut', 'it' => 'Beirut', 'pt' => 'Beirute', 'ru' => 'Бейрут', 'uk' => 'Бейрут', 'tr' => 'Beyrut', 'zh' => '贝鲁特', 'ja' => 'ベイルート'],
        'amman'        => ['en' => 'Amman', 'ar' => 'عمّان', 'fr' => 'Amman', 'de' => 'Amman', 'es' => 'Amán', 'it' => 'Amman', 'pt' => 'Amã', 'ru' => 'Амман', 'uk' => 'Амман', 'tr' => 'Amman', 'zh' => '安曼', 'ja' => 'アンマン'],
        'baghdad'      => ['en' => 'Baghdad', 'ar' => 'بغداد', 'fr' => 'Bagdad', 'de' => 'Bagdad', 'es' => 'Bagdad', 'it' => 'Baghdad', 'pt' => 'Bagdá', 'ru' => 'Багдад', 'uk' => 'Багдад', 'tr' => 'Bağdat', 'zh' => '巴格达', 'ja' => 'バグダッド'],
        'damascus'     => ['en' => 'Damascus', 'ar' => 'دمشق', 'fr' => 'Damas', 'de' => 'Damaskus', 'es' => 'Damasco', 'it' => 'Damasco', 'pt' => 'Damasco', 'ru' => 'Дамаск', 'uk' => 'Дамаск', 'tr' => 'Şam', 'zh' => '大马士革', 'ja' => 'ダマスカス'],
        'kyiv'         => ['en' => 'Kyiv', 'ar' => 'كييف', 'fr' => 'Kiev', 'de' => 'Kiew', 'es' => 'Kiev', 'it' => 'Kiev', 'pt' => 'Kiev', 'ru' => 'Киев', 'uk' => 'Київ', 'tr' => 'Kiev', 'zh' => '基辅', 'ja' => 'キーウ'],
        'kharkiv'      => ['en' => 'Kharkiv', 'ar' => 'خاركيف', 'fr' => 'Kharkiv', 'de' => 'Charkiw', 'es' => 'Járkov', 'it' => 'Kharkiv', 'pt' => 'Carcóvia', 'ru' => 'Харьков', 'uk' => 'Харків', 'tr' => 'Harkiv', 'zh' => '哈尔科夫', 'ja' => 'ハルキウ'],
        'odesa'        => ['en' => 'Odesa', 'ar' => 'أوديسا', 'fr' => 'Odessa', 'de' => 'Odessa', 'es' => 'Odesa', 'it' => 'Odessa', 'pt' => 'Odessa', 'ru' => 'Одесса', 'uk' => 'Одеса', 'tr' => 'Odessa', 'zh' => '敖德萨', 'ja' => 'オデーサ'],
        'lviv'         => ['en' => 'Lviv', 'ar' => 'ليفيف', 'fr' => 'Lviv', 'de' => 'Lemberg', 'es' => 'Leópolis', 'it' => 'Leopoli', 'pt' => 'Lviv', 'ru' => 'Львов', 'uk' => 'Львів', 'tr' => 'Lviv', 'zh' => '利沃夫', 'ja' => 'リヴィウ'],
        'dnipro'       => ['en' => 'Dnipro', 'ar' => 'دنيبرو', 'fr' => 'Dnipro', 'de' => 'Dnipro', 'es' => 'Dnipró', 'it' => 'Dnipro', 'pt' => 'Dnipro', 'ru' => 'Днепр', 'uk' => 'Дніпро', 'tr' => 'Dnipro', 'zh' => '第聂伯罗', 'ja' => 'ドニプロ'],
        'istanbul'     => ['en' => 'Istanbul', 'ar' => 'إسطنبول', 'fr' => 'Istanbul', 'de' => 'Istanbul', 'es' => 'Estambul', 'it' => 'Istanbul', 'pt' => 'Istambul', 'ru' => 'Стамбул', 'uk' => 'Стамбул', 'tr' => 'İstanbul', 'zh' => '伊斯坦布尔', 'ja' => 'イスタンブール'],
        'ankara'       => ['en' => 'Ankara', 'ar' => 'أنقرة', 'fr' => 'Ankara', 'de' => 'Ankara', 'es' => 'Ankara', 'it' => 'Ankara', 'pt' => 'Ancara', 'ru' => 'Анкара', 'uk' => 'Анкара', 'tr' => 'Ankara', 'zh' => '安卡拉', 'ja' => 'アンカラ'],
        'izmir'        => ['en' => 'Izmir', 'ar' => 'إزمير', 'fr' => 'Izmir', 'de' => 'Izmir', 'es' => 'Esmirna', 'it' => 'Smirne', 'pt' => 'Esmirna', 'ru' => 'Измир', 'uk' => 'Ізмір', 'tr' => 'İzmir', 'zh' => '伊兹密尔', 'ja' => 'イズミル'],
        'london'       => ['en' => 'London', 'ar' => 'لندن', 'fr' => 'Londres', 'de' => 'London', 'es' => 'Londres', 'it' => 'Londra', 'pt' => 'Londres', 'ru' => 'Лондон', 'uk' => 'Лондон', 'tr' => 'Londra', 'zh' => '伦敦', 'ja' => 'ロンドン'],
        'paris'        => ['en' => 'Paris', 'ar' => 'باريس', 'fr' => 'Paris', 'de' => 'Paris', 'es' => 'París', 'it' => 'Parigi', 'pt' => 'Paris', 'ru' => 'Париж', 'uk' => 'Париж', 'tr' => 'Paris', 'zh' => '巴黎', 'ja' => 'パリ'],
        'berlin'       => ['en' => 'Berlin', 'ar' => 'برلين', 'fr' => 'Berlin', 'de' => 'Berlin', 'es' => 'Berlín', 'it' => 'Berlino', 'pt' => 'Berlim', 'ru' => 'Берлин', 'uk' => 'Берлін', 'tr' => 'Berlin', 'zh' => '柏林', 'ja' => 'ベルリン'],
        'madrid'       => ['en' => 'Madrid', 'ar' => 'مدريد', 'fr' => 'Madrid', 'de' => 'Madrid', 'es' => 'Madrid', 'it' => 'Madrid', 'pt' => 'Madrid', 'ru' => 'Мадрид', 'uk' => 'Мадрид', 'tr' => 'Madrid', 'zh' => '马德里', 'ja' => 'マドリード'],
        'rome'         => ['en' => 'Rome', 'ar' => 'روما', 'fr' => 'Rome', 'de' => 'Rom', 'es' => 'Roma', 'it' => 'Roma', 'pt' => 'Roma', 'ru' => 'Рим', 'uk' => 'Рим', 'tr' => 'Roma', 'zh' => '罗马', 'ja' => 'ローマ'],
        'moscow'       => ['en' => 'Moscow', 'ar' => 'موسكو', 'fr' => 'Moscou', 'de' => 'Moskau', 'es' => 'Moscú', 'it' => 'Mosca', 'pt' => 'Moscou', 'ru' => 'Москва', 'uk' => 'Москва', 'tr' => 'Moskova', 'zh' => '莫斯科', 'ja' => 'モスクワ'],
        'new_york'     => ['en' => 'New York', 'ar' => 'نيويورك', 'fr' => 'New York', 'de' => 'New York', 'es' => 'Nueva York', 'it' => 'New York', 'pt' => 'Nova Iorque', 'ru' => 'Нью-Йорк', 'uk' => 'Нью-Йорк', 'tr' => 'New York', 'zh' => '纽约', 'ja' => 'ニューヨーク'],
    ];

    /** A few extra common spellings that don't already appear as one of CITIES' own values. */
    private const ALIASES = [
        'kiev'        => 'kyiv',
        'kharkov'     => 'kharkiv',
        'odessa'      => 'odesa',
        'lvov'        => 'lviv',
        'lemberg'     => 'lviv',
        'mekkah'      => 'mecca',
        'makkah'      => 'mecca',
        'al madinah'  => 'medina',
        'al-madinah'  => 'medina',
        'kuwait'      => 'kuwait_city',
        'nyc'         => 'new_york',
        'dnepr'       => 'dnipro',
        'dnepropetrovsk' => 'dnipro',
        'smyrna'      => 'izmir',
    ];

    private static ?array $lookup = null;

    /**
     * @param  string|null  $raw  the city exactly as the restaurant owner typed it
     * @param  string|null  $locale  the viewer's current locale
     * @return string|null  the localised name, or $raw unchanged if it isn't one of the recognised common cities
     */
    public function translate(?string $raw, ?string $locale): ?string
    {
        if ($raw === null || trim($raw) === '') {
            return $raw;
        }

        $key = self::lookup()[$this->normalize($raw)] ?? null;
        if (! $key) {
            return $raw;
        }

        $names = self::CITIES[$key];

        return ($locale && isset($names[$locale])) ? $names[$locale] : ($names['en'] ?? $raw);
    }

    private function normalize(string $value): string
    {
        return mb_strtolower(trim($value), 'UTF-8');
    }

    /** @return array<string, string> normalized spelling => canonical city key */
    private static function lookup(): array
    {
        if (self::$lookup !== null) {
            return self::$lookup;
        }

        $lookup = [];
        foreach (self::CITIES as $key => $names) {
            foreach ($names as $name) {
                $lookup[mb_strtolower(trim($name), 'UTF-8')] = $key;
            }
        }
        foreach (self::ALIASES as $alias => $key) {
            $lookup[$alias] = $key;
        }

        return self::$lookup = $lookup;
    }
}
