import json

# 读取数据库
with open('data/workbench.db', 'r', encoding='utf-8') as f:
    db = json.load(f)

notifications = db.get('notifications', [])
print(f"原始通知数量: {len(notifications)}")

# 按 relatedId + relatedType 分组，保留最新的未读通知
from collections import defaultdict
import datetime

groups = defaultdict(list)
for n in notifications:
    key = (n.get('relatedId'), n.get('relatedType'))
    groups[key].append(n)

# 保留每组最新的未读通知
cleaned = []
for key, group in groups.items():
    # 按 created_at 排序，取最新的
    sorted_group = sorted(group, key=lambda x: x.get('created_at', ''), reverse=True)
    # 取最新的一条未读通知
    unread = next((n for n in sorted_group if not n.get('read')), None)
    if unread:
        cleaned.append(unread)
    elif sorted_group:
        cleaned.append(sorted_group[0])

print(f"清理后通知数量: {len(cleaned)}")

# 更新数据库
db['notifications'] = cleaned

# 写回数据库
with open('data/workbench.db', 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)

print("清理完成！")
