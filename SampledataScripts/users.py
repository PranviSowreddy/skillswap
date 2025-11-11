import json
import random
from datetime import datetime, timedelta
from faker import Faker

# Use Indian locale for names
fake = Faker('en_IN')

NUM_USERS = 500  # Number of users to generate
users = []

for i in range(1, NUM_USERS + 1):
    # Numeric ID only
    user_id = 1000 + i

    # Random Indian name
    name = fake.name()

    # Simple, realistic Indian-style email
    email = (
        name.lower()
        .replace(" ", "")
        .replace(".", "")
        + str(random.randint(1, 99))
        + "@gmail.com"
    )

    # Short fake password hash (10 characters)
    password_hash = ''.join(random.choices('abcdef0123456789', k=10))

    # Random creation datetime within last year
    created_dt = fake.date_time_between(start_date="-1y", end_date="now")
    updated_dt = created_dt + timedelta(days=random.randint(0, 60), hours=random.randint(0, 12))

    # Format as YYYY-MM-DD HH:MM:SS
    created_at = created_dt.strftime("%Y-%m-%d %H:%M:%S")
    updated_at = updated_dt.strftime("%Y-%m-%d %H:%M:%S")

    user_doc = {
        "id": user_id,
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "created_at": created_at,
        "updated_at": updated_at
    }

    users.append(user_doc)

# Save all users to JSON file
with open("users.json", "w", encoding="utf-8") as f:
    json.dump(users, f, indent=4, ensure_ascii=False)

print(f"✅ Generated {NUM_USERS} user records (numeric IDs) in users.json")
