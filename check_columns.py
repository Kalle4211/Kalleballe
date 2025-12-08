import pandas as pd
import os

# --- Configuration ---
HOME_DIR = os.path.expanduser("~")
DOWNLOADS_FOLDER = os.path.join(HOME_DIR, 'Downloads')
INPUT_FILENAME = 'batch_lookup_detail_20251123003028(UTC+0000).xlsx'

# --- File Path ---
input_file_path = os.path.join(DOWNLOADS_FOLDER, INPUT_FILENAME)

try:
    # --- Read the file and print columns ---
    df = pd.read_excel(input_file_path, engine='openpyxl')
    print("Here are the goddamn columns in that file, Alpha:")
    for i, col in enumerate(df.columns):
        print(f"Column {i} (what you'd call {chr(65+i)}): '{col}'")

except FileNotFoundError:
    print(f"Shit, couldn't find the fucking file: {input_file_path}")
except Exception as e:
    print(f"A goddamn error occurred: {e}")


