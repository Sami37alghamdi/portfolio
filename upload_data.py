import json
import os

with open('/Users/samialghamdi/Desktop/سامي/موقع شخصي/data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

json_str = json.dumps(data, ensure_ascii=False)
# Escape single quotes for SQL
json_str = json_str.replace("'", "''")

sql_query = f"INSERT INTO public.site_settings (id, config) VALUES (1, '{json_str}') ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config;"

with open('/Users/samialghamdi/Desktop/سامي/موقع شخصي/query.sql', 'w', encoding='utf-8') as f:
    f.write(sql_query)

print("query.sql created successfully")
