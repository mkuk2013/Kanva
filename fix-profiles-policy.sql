-- Kanva fix (2026-10-20): Super Admin se kisi user ko Pro/Block karne par
-- toast "ho gaya" ata tha lekin database mein plan save nahi hota tha,
-- kyunke live database ki profiles UPDATE policy mein admin wali ijazat
-- (is_admin) wala hissa missing tha — update khamoshi se 0 rows par lagta tha.
--
-- Supabase Dashboard -> SQL Editor mein ye pura paste karke Run karein (sirf ek dafa).

drop policy if exists "profiles own update" on public.profiles;

create policy "profiles own update" on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- Tasdeeq (optional): neeche wali query chala kar dekhein ke policy ban gayi hai:
-- select policyname, cmd, qual from pg_policies where tablename = 'profiles';
