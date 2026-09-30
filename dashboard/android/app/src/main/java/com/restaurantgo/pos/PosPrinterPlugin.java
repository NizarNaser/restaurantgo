package com.restaurantgo.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.UUID;

/**
 * Sends raw ESC/POS bytes straight to a thermal printer over WiFi (TCP port
 * 9100, the near-universal raw-printing port) or Bluetooth (SPP) — no
 * printer-selection dialog. The connection details (address, type) come
 * from RestaurantGo's Printer settings, looked up ahead of time on the JS
 * side, so this plugin only ever has to open a socket and write bytes.
 */
@CapacitorPlugin(
    name = "PosPrinter",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth")
    }
)
public class PosPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int WIFI_PORT = 9100;
    private static final int SOCKET_TIMEOUT_MS = 5000;

    @PluginMethod
    public void print(PluginCall call) {
        String connectionType = call.getString("connectionType");
        String address = call.getString("address");
        String data = call.getString("data");

        if (connectionType == null || address == null || data == null) {
            call.reject("connectionType, address and data are all required.");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("data must be base64-encoded ESC/POS bytes.");
            return;
        }

        new Thread(() -> {
            try {
                if ("bluetooth".equals(connectionType)) {
                    printOverBluetooth(address, bytes);
                } else {
                    printOverWifi(address, bytes);
                }
                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Could not reach the printer: " + e.getMessage(), e);
            }
        }).start();
    }

    private void printOverWifi(String address, byte[] bytes) throws Exception {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(address, WIFI_PORT), SOCKET_TIMEOUT_MS);
            OutputStream out = socket.getOutputStream();
            out.write(bytes);
            out.flush();
        }
    }

    private void printOverBluetooth(String address, byte[] bytes) throws Exception {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            throw new SecurityException("Bluetooth permission was not granted.");
        }

        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager != null ? manager.getAdapter() : null;
        if (adapter == null) {
            throw new IllegalStateException("This device has no Bluetooth adapter.");
        }

        BluetoothDevice device = adapter.getRemoteDevice(address);
        BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            adapter.cancelDiscovery();
            socket.connect();
            OutputStream out = socket.getOutputStream();
            out.write(bytes);
            out.flush();
        } finally {
            socket.close();
        }
    }
}
