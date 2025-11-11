import json
import random
from faker import Faker

# Initialize Faker for Indian names/timezones
fake = Faker('en_IN')

# --- Load existing users.json ---
with open("users.json", "r", encoding="utf-8") as f:
    users = json.load(f)

# --- Load all skills from skills_with_ids.json ---
with open("skills.json", "r", encoding="utf-8") as f:
    skills_data = json.load(f)
    # Extract just the skill names
    skills_pool = [s["name"] for s in skills_data]

# --- Options for other fields ---
sessions_options = ["1", "2–3", "4–6", "7–10"]
days_options = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
timezones = ["UTC-10.5", "UTC-7.0", "UTC+0.0", "UTC+5.5", "UTC+6.5", "UTC+9.0"]
availability_slots = ["Morning", "Afternoon", "Evening", "Night"]
formats = ["video", "in-person", "chat", "phone", "flexible"]

profiles = []

# --- Generate one profile per user ---
for user in users:
    profile_id = user["id"]   # reuse user id
    name = user["name"]       # reuse name

    # Select 1–3 teach and learn skills (by name)
    skills_to_teach = random.sample(skills_pool, k=random.randint(1, 3))
    remaining_skills = [s for s in skills_pool if s not in skills_to_teach]
    skills_to_learn = random.sample(remaining_skills, k=random.randint(1, 3))

    sessions_wanted = random.choice(sessions_options)
    preferred_days = random.sample(days_options, k=random.randint(1, 4))
    timezone = random.choice(timezones)
    availability = random.sample(availability_slots, k=random.randint(1, 3))
    preferred_format = random.sample(formats, k=random.randint(1, 3))

    # Create profile document
    profile_doc = {
        "id": profile_id,
        "name": name,
        "skillsToTeach": skills_to_teach,
        "skillsToLearn": skills_to_learn,
        "sessionsWanted": sessions_wanted,
        "preferredDays": preferred_days,
        "timezone": timezone,
        "availability": availability,
        "preferredFormat": preferred_format
    }

    profiles.append(profile_doc)

# --- Save all generated profiles ---
with open("profiles.json", "w", encoding="utf-8") as f:
    json.dump(profiles, f, indent=4, ensure_ascii=False)

print(f"✅ Generated {len(profiles)} profiles linked to users.json → saved in profiles.json")
