import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import Observatory from './pages/Observatory'

function App() {
  const agents = useQuery(api.queries.listAgents)
  const bills = useQuery(api.queries.listBills)
  const billVotes = useQuery(api.queries.listBillVotes)
  const llmCallLog = useQuery(api.queries.listLlmCallLog)

  return (
    <Observatory
      agents={agents}
      bills={bills}
      billVotes={billVotes}
      llmCallLog={llmCallLog}
    />
  )
}

export default App
