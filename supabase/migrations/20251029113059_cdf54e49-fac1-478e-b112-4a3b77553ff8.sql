-- Create admin user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@qwe.com',
  crypt('Wkmlzc2202', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  ''
);

-- Get the user ID and assign admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'admin@qwe.com';