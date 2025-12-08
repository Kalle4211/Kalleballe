import pandas as pd
import os
import numpy as np

# --- Configuration ---
HOME_DIR = os.path.expanduser("~")
DOWNLOADS_FOLDER = os.path.join(HOME_DIR, 'Downloads')
INPUT_FILENAME = 'batch_lookup_detail_20251123003028(UTC+0000).xlsx'
OUTPUT_FOLDER_NAME = 'franklin numbers'
BATCH_SIZE = 30
CARRIERS_TO_FILTER = ['telia', 'telenor']
NUMBER_COLUMN_NAME = 'Number'
CARRIER_COLUMN_NAME = 'networkname'

# --- File Paths ---
input_file_path = os.path.join(DOWNLOADS_FOLDER, INPUT_FILENAME)
output_dir_path = os.path.join(DOWNLOADS_FOLDER, OUTPUT_FOLDER_NAME)

try:
    # --- 1. Create output directory ---
    os.makedirs(output_dir_path, exist_ok=True)
    print(f"Output directory '{output_dir_path}' is ready. 👍")

    # --- 2. Read the input XLSX file ---
    df = pd.read_excel(input_file_path, engine='openpyxl')
    print(f"Successfully read the fucking file: {input_file_path}")

    # --- 3. Filter the data ---
    df_filtered = df.copy()
    df_filtered[CARRIER_COLUMN_NAME] = df_filtered[CARRIER_COLUMN_NAME].astype(str).str.lower()
    
    initial_count = len(df_filtered)
    df_filtered = df_filtered[~df_filtered[CARRIER_COLUMN_NAME].isin(CARRIERS_TO_FILTER)]
    final_count = len(df_filtered)

    print(f"Filtered out {initial_count - final_count} numbers from Telia/Telenor. Good riddance. 🖕")
    print(f"{final_count} numbers remaining.")

    # --- 4. Create and save batches ---
    remaining_numbers = df_filtered[NUMBER_COLUMN_NAME].tolist()
    num_batches = int(np.ceil(len(remaining_numbers) / BATCH_SIZE))
    print(f"Splitting into {num_batches} batches of {BATCH_SIZE}.")

    for i, batch_start in enumerate(range(0, len(remaining_numbers), BATCH_SIZE)):
        batch_numbers = remaining_numbers[batch_start : batch_start + BATCH_SIZE]
        batch_df = pd.DataFrame(batch_numbers)
        output_filename = f'batch_{i + 1}.xlsx'
        output_filepath = os.path.join(output_dir_path, output_filename)
        batch_df.to_excel(output_filepath, index=False, header=False, engine='openpyxl')
        
    print(f"Fuck yeah! All {num_batches} batches are saved in '{output_dir_path}'. Job's done, Alpha. 🤘")

except FileNotFoundError:
    print(f"Shit, couldn't find the fucking file: {input_file_path}")
except KeyError as e:
    print(f"Fucking hell, the column {e} was not found. Check the column names again.")
except Exception as e:
    print(f"A goddamn error occurred: {e}")


