# Security Specification for Governance Platform

This document outlines the security architecture, data invariants, and adversarial test payloads designed to verify the security of the Firestore database.

## Data Invariants

1. **Letter Integrity**: A tracked letter cannot be created or updated without a valid `entity_source`, `letter_number`, `letter_date`, `due_date`, and `status`.
2. **Key Immutability**: Critical identifier fields like letter `id`, settings `key`, or user `email` must remain immutable after creation.
3. **Volumetric Boundaries**: Field lengths must be bounded to prevent Denial of Wallet and buffer overflow simulation attacks (e.g. status under 50 characters, phone numbers under 20 characters).
4. **Valid Enums**: Fields like priority (`عالية`, `متوسطة`, `منخفضة`) and status (`جديد`, `الحاقي`, `مغلق`) must adhere to their strict lists.

## The "Dirty Dozen" Payloads (Adversarial Test Suite)

Here are twelve adversarial payloads designed to test the robust defense of our security rules:

1. **Payload 1 (Ghost Field Injection)**: Creating a letter with an undocumented, unvalidated property (`hack_field: "injected"`).
2. **Payload 2 (Invalid Status Enum)**: Creating a letter with status set to `مفتوح` instead of `جديد`, `الحاقي`, or `مغلق`.
3. **Payload 3 (Invalid Priority Enum)**: Setting priority to `طارئة` which is not in the allowed priority enum.
4. **Payload 4 (Extreme String Injection)**: Injecting a 2MB base64 string into `letter_number` to trigger Denial of Wallet.
5. **Payload 5 (Immutable Field Mutation)**: Attempting to modify `created_at` timestamp on an existing letter.
6. **Payload 6 (Invalid Date Format)**: Creating a letter with `due_date` set to `not-a-date` instead of `YYYY-MM-DD`.
7. **Payload 7 (Missing Required Fields)**: Creating a letter without the mandatory `letter_date` field.
8. **Payload 8 (Invalid Setting Key Format)**: Creating a setting with a key containing malicious characters (e.g. `../global`).
9. **Payload 9 (Unauthorized Role Mutation)**: A standard staff user attempting to mutate their own role to `manager`.
10. **Payload 10 (Spoofed ID)**: Creating a document under `/users/{userId}` where the document ID does not match the actual user's UID.
11. **Payload 11 (Huge Log Message)**: Creating a WhatsApp log with `message_content` exceeding 10,000 characters.
12. **Payload 12 (Negative Index/Time Poisoning)**: Setting `sent_at` timestamp on WhatsApp log to a future date or a plain string instead of ISO timestamp.

## The Test Runner (firestore.rules.test.ts)

A TypeScript test runner using the Firebase rules unit testing framework will execute these payloads and assert that they return `PERMISSION_DENIED` on the security rules under strict conditions.
