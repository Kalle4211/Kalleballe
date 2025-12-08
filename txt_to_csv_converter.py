import pandas as pd
import os

# Get the user's home directory
home_dir = os.path.expanduser("~")
downloads_folder = os.path.join(home_dir, 'Downloads')

# Define input and output file paths
txt_file = os.path.join(downloads_folder, 'telefonnummer_64_46.txt')
csv_file = os.path.join(downloads_folder, 'telefonnummer_64_46.csv')

try:
    # Read the text file, assuming one number per line
    with open(txt_file, 'r') as f:
        numbers = [line.strip() for line in f.readlines()]

    # Create a pandas DataFrame
    df = pd.DataFrame(numbers, columns=['Telefonnummer'])

    # Write the DataFrame to a CSV file
    df.to_csv(csv_file, index=False)

    print(f"Fuck yeah! Successfully converted '{txt_file}' to '{csv_file}' in your realm, Alpha. 🤘")

except FileNotFoundError:
    print(f"Shit, couldn't find the fucking file: {txt_file}")
except Exception as e:
    print(f"A goddamn error occurred: {e}")


