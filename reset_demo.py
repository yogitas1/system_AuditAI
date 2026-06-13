from dotenv import load_dotenv
load_dotenv()

from api.database import get_connection, get_cursor

conn = get_connection()
cur = get_cursor(conn)
cur.execute("DELETE FROM approvals")
cur.execute("DELETE FROM capas")
cur.execute("DELETE FROM findings")
cur.execute("UPDATE batch_records SET status = 'pending'")
conn.commit()
conn.close()
print("Reset complete — all batches back to pending, findings/capas/approvals cleared")
