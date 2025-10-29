// 临时脚本：创建管理员用户
// 运行方式：在浏览器控制台中直接执行

const createAdminUser = async () => {
  const response = await fetch('https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/create-admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
    },
    body: JSON.stringify({
      email: 'admin@qwe.com',
      password: 'Wkmlzc2202'
    })
  });
  
  const result = await response.json();
  console.log('Result:', result);
  return result;
};

createAdminUser();
