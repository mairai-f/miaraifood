INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES
  ('food', 'restaurant.qr_menu', true),
  ('food_offline', 'restaurant.qr_menu', true)
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET enabled = EXCLUDED.enabled;

UPDATE public.subscription_plans
SET
  description = CASE id
    WHEN 'food' THEN 'Sistema restaurante web com mesas, comandas, cardapio digital, QR de mesa, garcom, cozinha, delivery, caixa, estoque e relatorios.'
    WHEN 'food_offline' THEN 'HappyCashFood com cardapio digital, sistema offline, executavel Windows, Linux, pacote .deb, AppImage e Android APK.'
    ELSE description
  END,
  updated_at = now()
WHERE id IN ('food', 'food_offline');
