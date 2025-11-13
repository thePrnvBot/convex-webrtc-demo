import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {

  return (
    <main className="p-8 flex flex-col gap-16">
      <h1 className="scroll-m-20 text-center text-4xl tracking-tight text-balance text-shadow-amber-700 text-shadow-xl font-semibold">Hello World!</h1>
    </main>
  )
}