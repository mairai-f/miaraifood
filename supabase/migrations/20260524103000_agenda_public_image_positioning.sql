-- Image focal points for direct public-page editing in HappyCash Agenda.

ALTER TABLE public.agenda_business_settings
  ADD COLUMN IF NOT EXISTS hero_image_position_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS hero_image_position_y numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS hero_image_scale numeric NOT NULL DEFAULT 1.1,
  ADD COLUMN IF NOT EXISTS about_image_position_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS about_image_position_y numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS about_image_scale numeric NOT NULL DEFAULT 1;

ALTER TABLE public.agenda_business_settings
  ADD CONSTRAINT agenda_business_settings_hero_position_x_range
    CHECK (hero_image_position_x >= 0 AND hero_image_position_x <= 100) NOT VALID,
  ADD CONSTRAINT agenda_business_settings_hero_position_y_range
    CHECK (hero_image_position_y >= 0 AND hero_image_position_y <= 100) NOT VALID,
  ADD CONSTRAINT agenda_business_settings_hero_scale_range
    CHECK (hero_image_scale >= 1 AND hero_image_scale <= 2) NOT VALID,
  ADD CONSTRAINT agenda_business_settings_about_position_x_range
    CHECK (about_image_position_x >= 0 AND about_image_position_x <= 100) NOT VALID,
  ADD CONSTRAINT agenda_business_settings_about_position_y_range
    CHECK (about_image_position_y >= 0 AND about_image_position_y <= 100) NOT VALID,
  ADD CONSTRAINT agenda_business_settings_about_scale_range
    CHECK (about_image_scale >= 1 AND about_image_scale <= 2) NOT VALID;
