#!/usr/bin/env python3
import smtplib
import os
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from datetime import date

PASSWORD_FILE = os.path.join(os.path.dirname(__file__), "..", ".gmail-app-password")
GMAIL_USER = "roitsch@gmail.com"

def load_password():
    path = os.path.expanduser(PASSWORD_FILE)
    with open(path) as f:
        return f.read().strip()

def send_backup(attachment_path):
    password = load_password()
    filename = os.path.basename(attachment_path)
    size_kb = round(os.path.getsize(attachment_path) / 1024, 1)

    msg = MIMEMultipart()
    msg["From"] = GMAIL_USER
    msg["To"] = GMAIL_USER
    msg["Subject"] = f"BrewLog Backup — {date.today()}"
    msg.attach(MIMEText(f"Weekly database backup attached ({size_kb} KB).", "plain"))

    with open(attachment_path, "rb") as f:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
        msg.attach(part)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, password)
        server.sendmail(GMAIL_USER, GMAIL_USER, msg.as_string())
        print(f"Email sent ({size_kb} KB attachment)")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: backup-email.py <backup-file>")
        sys.exit(1)
    send_backup(sys.argv[1])
