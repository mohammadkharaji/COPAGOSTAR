package com.copagostar.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.widget.Button;
import android.widget.Toast;

public class MainActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        Button btnPin = findViewById(R.id.btn_pin_widget);
        Button btnOpen = findViewById(R.id.btn_open_dashboard);

        btnPin.setOnClickListener(v -> pinWidget());
        btnOpen.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://copadash.amadehlaziz.com/#overview"));
            startActivity(intent);
        });

        // Trigger widget pin request
        pinWidget();
    }

    private void pinWidget() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager manager = getSystemService(AppWidgetManager.class);
            ComponentName provider = new ComponentName(this, CopaWidgetProvider.class);
            if (manager != null && manager.isRequestPinAppWidgetSupported()) {
                manager.requestPinAppWidget(provider, null, null);
                return;
            }
        }
        Toast.makeText(this, "لطفاً از منوی ویجت‌ها، «Copa - نبض فروش» را به صفحه اصلی اضافه کنید", Toast.LENGTH_LONG).show();
    }
}
