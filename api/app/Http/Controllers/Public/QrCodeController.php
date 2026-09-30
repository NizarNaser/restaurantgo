<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\QrCode;
use Illuminate\Http\RedirectResponse;

class QrCodeController extends Controller
{
    /**
     * What a printed QR code actually points at — counts the scan, then
     * bounces the customer's phone straight to the real page. No auth,
     * no tenant resolution: the code's id alone is enough, and it's
     * meant to be scanned by anyone.
     */
    public function scan(QrCode $qrCode): RedirectResponse
    {
        $qrCode->increment('scan_count');

        return redirect()->away($qrCode->target_url);
    }
}
