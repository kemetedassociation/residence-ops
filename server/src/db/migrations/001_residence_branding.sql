ALTER TABLE residences ADD COLUMN display_name TEXT;
ALTER TABLE residences ADD COLUMN logo_url TEXT;
ALTER TABLE residences ADD COLUMN primary_color TEXT;
ALTER TABLE residences ADD COLUMN plan TEXT NOT NULL DEFAULT 'standard' CHECK (plan IN ('standard','premium'));
