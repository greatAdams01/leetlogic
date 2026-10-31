CREATE TABLE account_role_conflicts AS
SELECT u.id AS user_id, array_agg(c.capability::text) FILTER (WHERE c.capability IS NOT NULL) AS previous_roles,
       EXISTS (SELECT 1 FROM farmer_profiles f WHERE f.user_id = u.id) AS has_farmer_profile,
       now() AS recorded_at
FROM users u LEFT JOIN user_capabilities c ON c.user_id = u.id
GROUP BY u.id HAVING count(c.capability) <> 1;
-- Historical seller onboarding added SELLER while retaining the default BUYER.
DELETE FROM user_capabilities c USING account_role_conflicts a
WHERE c.user_id = a.user_id AND (NOT a.has_farmer_profile OR c.capability = 'BUYER');
INSERT INTO user_capabilities (user_id, capability, granted_at)
SELECT user_id, 'SELLER', now() FROM account_role_conflicts a
WHERE has_farmer_profile AND NOT EXISTS (SELECT 1 FROM user_capabilities c WHERE c.user_id = a.user_id);
CREATE UNIQUE INDEX user_capabilities_user_id_key ON user_capabilities(user_id);
