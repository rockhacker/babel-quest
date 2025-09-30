-- 更新测试用的原始URL为Google，更安全且不会被反爬虫
UPDATE originals 
SET url = 'https://www.google.com' 
WHERE id = '122a6893-da05-45ee-8c4d-377af3855cc8';