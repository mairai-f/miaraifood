package br.miarai.food.gestor;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KioskModePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
