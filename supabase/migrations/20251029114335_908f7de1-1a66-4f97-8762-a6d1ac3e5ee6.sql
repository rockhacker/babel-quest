-- 删除所有之前创建的测试用户
DELETE FROM public.user_roles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'admin@qwe.com'
);
DELETE FROM auth.users WHERE email = 'admin@qwe.com';