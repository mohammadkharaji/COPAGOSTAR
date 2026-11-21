package com.copagostar.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {

    static final String PREFS = "copa_widget";
    static final String TOKEN = "widget_token";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        EditText input = findViewById(R.id.input_token);
        TextView status = findViewById(R.id.txt_status);
        input.setText(getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(TOKEN, ""));

        findViewById(R.id.btn_save_token).setOnClickListener(v -> {
            String token = input.getText().toString().trim();
            if (!token.startsWith("srw_")) {
                status.setText("توکن باید با srw_ شروع شود");
                return;
            }
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(TOKEN, token).apply();
            status.setText("ذخیره شد؛ ویجت در حال به‌روزرسانی است");
            CopaWidgetProvider.refreshAll(this);
        });

        Button btnPin = findViewById(R.id.btn_pin_widget);
        Button btnOpen = findViewById(R.id.btn_open_dashboard);

        btnPin.setOnClickListener(v -> pinWidget());
        btnOpen.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://copadash.amadehlaziz.com/#overview"));
            startActivity(intent);
        });
    }

    // The widget auto-pins once, on the first launch only: onUpdate keeps running otherwise, which would re-ask every time.
    private void pinWidget() {
        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (prefs.getBoolean("auto_pinned", false)) {
            Toast.makeText(this, "ویجت را از منوی ویجت‌ها می‌توانید اضافه کنید", Toast.LENGTH_SHORT).show();
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager manager = getSystemService(AppWidgetManager.class);
            ComponentName provider = new ComponentName(this, CopaWidgetProvider.class);
            if (manager != null && manager.isRequestPinAppWidgetSupported()) {
                prefs.edit().putBoolean("auto_pinned", true).apply();
                manager.requestPinAppWidget(provider, null, null);
                return;
            }
        }
        Toast.makeText(this, "لطفاً از منوی ویجت‌ها، «Copa - نبض فروش» را به صفحه اصلی اضافه کنید", Toast.LENGTH_LONG).show();
    }
}