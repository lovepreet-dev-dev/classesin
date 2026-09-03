# Environment setup

The local runtime file is [`.env.local`](./.env.local) (the leading dot means it may be hidden by Finder). It is intentionally ignored by Git. Add the two values below; do not commit this file:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://ziptpkwfwleedotiquyf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste-the-Supabase-publishable-key>
```

The shareable template is [`.env.example`](./.env.example). The project URL is safe to keep in the template; the publishable/anon key belongs only in `.env.local` or the hosting provider's environment settings.

After saving the file, run `npm run lint` and `npm run build`, then start the app with `npm run dev`.
