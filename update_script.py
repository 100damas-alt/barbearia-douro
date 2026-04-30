import sys

file_path = '/home/team/shared/website-project/public/index.html'
clean_script_path = '/home/team/shared/script-clean.js'

with open(file_path, 'r') as f:
    content = f.read()

with open(clean_script_path, 'r') as f:
    new_script = f.read()

start_marker = 'const API_BASE = window.location.origin;'
end_marker = '</script>'

start_idx = content.find(start_marker)
# Find the last closing script tag
end_idx = content.rfind(end_marker)

if start_idx != -1 and end_idx != -1:
    updated_content = content[:start_idx] + start_marker + '\n' + new_script + '\n' + content[end_idx:]
    with open(file_path, 'w') as f:
        f.write(updated_content)
    print("Update successful")
else:
    print(f"Markers not found: start={start_idx}, end={end_idx}")
