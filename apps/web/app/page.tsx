const platformCards = [
  {
    title: 'Web app',
    body: 'Next.js is the production web client. It is intended for deployment to Vercel and will host the browser-first experience for each feature domain.',
  },
  {
    title: 'Android app',
    body: 'Expo and React Native provide a separate Android client. Mobile UX stays independent from the web implementation while sharing the same backend.',
  },
  {
    title: 'Supabase backend',
    body: 'Auth, data, storage, and privileged workflows live behind the backend boundary. Shared behavior belongs here instead of duplicated frontend code.',
  },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">Personal App v2</div>
        <h1 className="headline">A personal platform built to keep growing.</h1>
        <p className="copy">
          This repository starts with a managed-first foundation: one web app,
          one Android app, and one backend as the source of truth. The next
          implementation step is to define the first real feature and wire both
          clients into a live Supabase project.
        </p>
        <a
          className="cta"
          href="https://vercel.com/docs"
          target="_blank"
          rel="noreferrer"
        >
          Deployment target: Vercel
        </a>
        <div className="panel-grid">
          {platformCards.map((card) => (
            <article className="panel" key={card.title}>
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </article>
          ))}
          <article className="panel">
            <h2>First feature checklist</h2>
            <ul>
              <li>choose the first personal workflow to productionize</li>
              <li>create a feature spec in `docs/features/`</li>
              <li>connect OAuth and environment variables</li>
              <li>define the initial Supabase schema and policies</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
