-- Ver a função atual
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'get_workspace_users_with_details';
