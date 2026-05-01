'use client';

export default function DataBoxPage() {
  return (
    <div className="wsd-page">
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Data Box</h1>
          <p style={styles.subtitle}>View and manage system data boxes</p>
        </div>
      </header>
      
      <div style={styles.placeholderCard}>
        <p style={styles.placeholderText}>Data Box section is ready for content.</p>
      </div>
    </div>
  );
}

const styles: any = {
  header: {
    marginBottom: '40px',
  },
  title: {
    fontSize: '34px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    marginBottom: '8px',
    letterSpacing: '-1px',
  },
  subtitle: {
    fontSize: '16px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  placeholderCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1.5px dashed var(--border-color)',
    borderRadius: '24px',
    padding: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '20px',
  },
  placeholderText: {
    color: 'var(--text-secondary)',
    fontSize: '16px',
    fontWeight: 500,
  }
};
