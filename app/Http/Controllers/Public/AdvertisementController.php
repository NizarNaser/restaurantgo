<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Advertisement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdvertisementController extends Controller
{
    public function active(Request $request): JsonResponse
    {
        $ads = Advertisement::active()
            ->when($request->placement, fn ($q) => $q->placement($request->placement))
            ->orderBy('sort_order')
            ->get(['id', 'title', 'advertiser_name', 'image_path', 'link_url', 'placement']);

        return response()->json($ads);
    }

    public function click(Advertisement $advertisement): JsonResponse
    {
        $advertisement->increment('click_count');

        return response()->json(['url' => $advertisement->link_url]);
    }
}
