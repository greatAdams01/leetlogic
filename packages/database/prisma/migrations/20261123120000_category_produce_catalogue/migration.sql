ALTER TABLE categories ADD COLUMN explanation TEXT NOT NULL DEFAULT '', ADD COLUMN produce_items TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
-- Preserve existing backend category examples as the initial authoritative produce catalogue.
UPDATE categories SET explanation = seed.explanation, produce_items = seed.items
FROM (VALUES
 ('vegetables', 'Vegetables used for cooking, such as tomatoes, peppers and leafy greens.', ARRAY['Tomatoes','Peppers','Leafy greens']),
 ('fruits', 'Fruit sold fresh, such as plantain and bananas.', ARRAY['Plantain','Bananas']),
 ('grains', 'Cereal crops, such as rice, maize and millet.', ARRAY['Rice','Maize','Millet']),
 ('roots-tubers', 'Crops harvested from under the soil, such as yam, cassava and potatoes.', ARRAY['Yam','Cassava','Potatoes']),
 ('legumes', 'Beans and related crops, such as peas and groundnuts.', ARRAY['Beans','Peas','Groundnuts']),
 ('oils', 'Edible oils, such as palm oil.', ARRAY['Palm oil']),
 ('processed-produce', 'Farm produce already processed for sale, such as garri and flour.', ARRAY['Garri','Flour','Dried produce'])
) AS seed(slug, explanation, items) WHERE categories.slug = seed.slug;
