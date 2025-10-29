-- 删除有问题的用户及其角色
DELETE FROM public.user_roles WHERE user_id = '95f95bb9-5585-49b7-8265-5167dceb871b';
DELETE FROM auth.users WHERE id = '95f95bb9-5585-49b7-8265-5167dceb871b';