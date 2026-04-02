export default function TransactionsPage({ type }: { type: string }) {
  return (
    <div style={{ padding: 24 }}>
      <h1>{type === 'ingreso' ? '¿Cuánto entró? 💚' : '¿Cuánto salió? 🔴'} 🚧</h1>
    </div>
  )
}