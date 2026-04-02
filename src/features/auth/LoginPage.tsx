export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--cf-bg)'
    }}>
      <div style={{
        background: 'var(--cf-bg-card)', padding: 40,
        borderRadius: 16, border: '1px solid var(--cf-border)',
        width: '100%', maxWidth: 400, textAlign: 'center'
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--cf-navy)', marginBottom: 8 }}>
          ContaFácil
        </h1>
        <p style={{ color: 'var(--cf-text-tertiary)', marginBottom: 32, fontSize: 14 }}>
          Tan fácil que hasta tu abuelita lleva sus cuentas
        </p>
        <p style={{ color: 'var(--cf-text-secondary)', fontSize: 14 }}>
          🚧 Login en construcción...
        </p>
      </div>
    </div>
  )
}