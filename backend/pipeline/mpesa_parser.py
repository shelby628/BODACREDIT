import re
from datetime import datetime
from typing import Optional
from dataclasses import dataclass


class Transaction:
    def __init__(self, raw_text, txn_type, amount, date, counterparty, category="unknown", direction="unknown"):
        self.raw_text = raw_text
        self.txn_type = txn_type
        self.amount = amount
        self.date = date
        self.counterparty = counterparty
        self.category = category
        self.direction = direction


_PATTERNS = [
    ("received", "in", re.compile(
        r"received Ksh([\d,]+\.\d{2}) from ([A-Z ]+?)\s+(\d{9,12})", re.IGNORECASE)),

    ("sent", "out", re.compile(
        r"Ksh([\d,]+\.\d{2}) sent to ([A-Z ]+?)\s+(?:\d{9,12}\s+)?for account", re.IGNORECASE)),

    ("paid", "out", re.compile(
        r"Ksh([\d,]+\.\d{2}) paid to ([A-Z0-9 .]+?)(?:\s+on|\s+for account|\.)", re.IGNORECASE)),

    ("withdraw", "out", re.compile(
        r"Ksh([\d,]+\.\d{2}) withdrawn from Agent \d+\s*-\s*([A-Z ]+)", re.IGNORECASE)),

    ("fuliza", "out", re.compile(
        r"Fuliza M-PESA amount is Ksh([\d,]+\.\d{2})", re.IGNORECASE)),

    ("airtime", "out", re.compile(
        r"bought Ksh([\d,]+\.\d{2}) of airtime", re.IGNORECASE)),
]


def segment_messages(raw_text):
    blocks = [b.strip() for b in re.split(r"\n\s*\n", raw_text) if b.strip()]

    if len(blocks) > 1:
        return blocks

    pattern = r"(?=[A-Z0-9]{10}\s+Confirmed\.)"
    parts = re.split(pattern, raw_text)
    return [p.strip() for p in parts if p.strip()]


def _parse_amount(amount_str):
    return float(amount_str.replace(",", ""))


def _parse_date(msg):
    match = re.search(r"on (\d{1,2}/\d{1,2}/\d{2,4})", msg)
    if not match:
        return None

    date_str = match.group(1)
    for fmt in ("%d/%m/%y", "%d/%m/%Y"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def extract_transaction(msg):
    for txn_type, direction, pattern in _PATTERNS:
        match = pattern.search(msg)
        if not match:
            continue

        amount = _parse_amount(match.group(1))
        counterparty = match.group(2).strip() if match.lastindex and match.lastindex >= 2 else ""
        date = _parse_date(msg)

        return Transaction(
            raw_text=msg,
            txn_type=txn_type,
            amount=amount,
            date=date,
            counterparty=counterparty,
            direction=direction,
        )

    return None


_CATEGORY_KEYWORDS = {
    "fuel":     ["PETROL", "TOTAL ENERGIES", "SHELL", "RUBIS", "OIL LIBYA", "FUEL"],
    "food":     ["HOTEL", "JAVA", "RESTAURANT", "KFC", "CAFE", "EATERY"],
    "savings":  ["SACCO", "CHAMA", "SAVINGS"],
    "airtime":  ["AIRTIME", "SAFARICOM AIRTIME"],
}


def classify_transaction(txn):
    if txn.txn_type == "received":
        return "income"
    if txn.txn_type == "airtime":
        return "airtime"
    if txn.txn_type == "withdraw":
        return "cash_withdrawal"
    if txn.txn_type == "fuliza":
        return "debt_repayment"

    counterparty_upper = txn.counterparty.upper()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        if any(keyword in counterparty_upper for keyword in keywords):
            return category

    if txn.txn_type == "sent":
        return "personal_transfer"

    return "unknown"


def aggregate_income(transactions):
    income_txns = [t for t in transactions if t.category == "income"]
    dated = [t for t in transactions if t.date is not None]

    if dated:
        days_span = (max(t.date for t in dated) - min(t.date for t in dated)).days + 1
    else:
        days_span = 1

    total_income = sum(t.amount for t in income_txns)
    avg_daily_income = round(total_income / days_span, 2) if days_span else total_income

    expense_breakdown = {}
    for t in transactions:
        if t.category == "income":
            continue
        expense_breakdown[t.category] = expense_breakdown.get(t.category, 0) + t.amount
    expense_breakdown = {k: round(v, 2) for k, v in expense_breakdown.items()}

    unrecognized_count = sum(1 for t in transactions if t.category == "unknown")

    return {
        "avg_daily_income":   avg_daily_income,
        "total_income":       round(total_income, 2),
        "days_span":          days_span,
        "num_income_txns":    len(income_txns),
        "expense_breakdown":  expense_breakdown,
        "unrecognized_count": unrecognized_count,
        "total_transactions": len(transactions),
    }


def parse_statement(raw_text):
    messages = segment_messages(raw_text)

    transactions = []
    unparsed_messages = []

    for msg in messages:
        txn = extract_transaction(msg)
        if txn is None:
            unparsed_messages.append(msg)
            continue
        txn.category = classify_transaction(txn)
        transactions.append(txn)

    summary = aggregate_income(transactions)
    summary["unparsed_message_count"] = len(unparsed_messages)
    summary["transactions"] = [
        {
            "type":         t.txn_type,
            "amount":       t.amount,
            "date":         t.date.isoformat() if t.date else None,
            "counterparty": t.counterparty,
            "category":     t.category,
            "direction":    t.direction,
        }
        for t in transactions
    ]

    return summary
if __name__ == "__main__":
    with open("sample_statement.txt") as f:
        raw = f.read()

    result = parse_statement(raw)

    print("Avg daily income:", result["avg_daily_income"])
    print("Total income:", result["total_income"])
    print("Days span:", result["days_span"])
    print("Expense breakdown:", result["expense_breakdown"])
    print("Unrecognized messages:", result["unparsed_message_count"])