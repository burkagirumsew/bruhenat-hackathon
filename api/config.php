<?php
/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * DirectAdmin Native Backend Configuration
 */

return [
    // Administrator Credentials (Default)
    'admin' => [
        'email' => 'admin@bruhenat-hackathon.org',
        // Default password: AdminPassword2026!
        'password_hash' => '$2y$10$OknF15f8Dk7pI1sTfq1aO.rDkF0c5K5tq1y4Zq5n3s1Q0b6f4c7e.',
        'full_name' => 'Platform Administrator',
        'role' => 'SUPER_ADMIN'
    ],

    // JWT / Token Secret Key
    'jwt_secret' => 'bruh_enat_women_tech_innovation_super_secret_key_2026_ethiopia_directadmin',

    // Storage Settings
    'storage' => [
        'type' => 'auto', // 'auto', 'sqlite', or 'json'
        'sqlite_path' => __DIR__ . '/data/biruh_enat.sqlite',
        'json_path' => __DIR__ . '/data/database.json',
    ],

    // Active Hackathon Sessions
    'active_session' => [
        'id' => 'sprint_day1',
        'name' => 'Day 1 Innovation Sprint',
        'venue' => 'Capstone ALX Tech Hub, Lideta, Addis Ababa',
        'date' => '2026-12-05',
        'is_active' => true
    ],

    // Total Capacity Limit
    'capacity' => 250
];
