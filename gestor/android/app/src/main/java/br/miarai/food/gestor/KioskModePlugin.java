package br.miarai.food.gestor;

import android.app.Activity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Kiosk mode "modo simples" (Screen Pinning), sem exigir Device Owner.
 *
 * Screen Pinning é a API pública do Android (startLockTask/stopLockTask)
 * que qualquer app pode chamar sobre a PRÓPRIA activity — trava o
 * dispositivo nesse app só (esconde barra de navegação/recents, bloqueia
 * o botão Home) até alguém segurar Voltar + Recentes (ou digitar a senha
 * do dispositivo, se configurado) pra sair. Suficiente pro caso de uso
 * pedido: travar o celular do colaborador dentro do app MIAR durante o
 * turno, sem precisar de provisionamento de fábrica (Device Owner) — essa
 * segunda opção fica pra uma versão mais robusta futura, se precisar.
 */
@CapacitorPlugin(name = "KioskMode")
public class KioskModePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity indisponível.");
            return;
        }
        try {
            activity.startLockTask();
            JSObject result = new JSObject();
            result.put("active", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Não foi possível ativar o modo quiosque: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity indisponível.");
            return;
        }
        try {
            activity.stopLockTask();
            JSObject result = new JSObject();
            result.put("active", false);
            call.resolve(result);
        } catch (Exception e) {
            // stopLockTask() lança exceção se o app não estiver pinado —
            // não é um erro real (ex.: dono nunca ativou o kiosk), então
            // resolve normal em vez de rejeitar.
            JSObject result = new JSObject();
            result.put("active", false);
            call.resolve(result);
        }
    }
}
