-- Delete the problematic user and their role
DELETE FROM public.user_roles WHERE user_id = '4767036e-d631-4c19-a9ec-c4239b294ed6';
DELETE FROM auth.users WHERE id = '4767036e-d631-4c19-a9ec-c4239b294ed6';