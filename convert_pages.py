#!/usr/bin/env python3
"""Convert Vite+wouter pages to Next.js App Router page.tsx files."""
import os
import re

SRC = "/home/user/workspace/soke-next/src/pages"
APP = "/home/user/workspace/soke-next/src/app/(dashboard)"

# mapping: source filename -> destination relative path under APP
MAPPING = {
    "dashboard.tsx": "dashboard/page.tsx",
    "search.tsx": "search/page.tsx",
    "submit-truth.tsx": "submit/page.tsx",
    "truth-feed.tsx": "feeds/page.tsx",
    "activity.tsx": "activity/page.tsx",
    "trends.tsx": "trends/page.tsx",
    "map.tsx": "map/page.tsx",
    "compare.tsx": "compare/page.tsx",
    "alerts.tsx": "alerts/page.tsx",
    "predictions.tsx": "predictions/page.tsx",
    "rewards.tsx": "rewards/page.tsx",
    "leaderboard.tsx": "leaderboard/page.tsx",
    "profile.tsx": "profile/page.tsx",
    "organizations.tsx": "organizations/page.tsx",
    "agency-auth.tsx": "agency-auth/page.tsx",
    "account-settings.tsx": "account/page.tsx",
    "privacy-policy.tsx": "privacy/page.tsx",
    "terms-of-use.tsx": "terms/page.tsx",
    "cookie-policy.tsx": "cookies/page.tsx",
    "operations.tsx": "operations/page.tsx",
    "not-found.tsx": "not-found.tsx",
}

def convert_content(src_filename, content):
    original = content

    # 1. Fix useToast import path
    content = content.replace(
        'from "@/hooks/use-toast"', 'from "@/components/hooks/use-toast"'
    )

    # 2. Replace wouter imports
    # useLocation used for navigation (setLocation(...)) -> useRouter + router.push
    if 'import { useLocation } from "wouter";' in content:
        content = content.replace(
            'import { useLocation } from "wouter";',
            'import { useRouter } from "next/navigation";',
        )
        # const [, setLocation] = useLocation();  -> const router = useRouter();
        content = re.sub(
            r'const \[,\s*setLocation\]\s*=\s*useLocation\(\);',
            'const router = useRouter();',
            content,
        )
        # setLocation("...") -> router.push("...")
        content = re.sub(r'\bsetLocation\(', 'router.push(', content)

    # Replace wouter Link import
    content = content.replace(
        'import { Link } from "wouter";', 'import Link from "next/link";'
    )

    # Replace wouter useNavigate (not seen yet, but per instructions)
    content = content.replace(
        'import { useNavigate } from "wouter";',
        'import { useRouter } from "next/navigation";',
    )

    # Fix any remaining /truths links to /feeds (route rename)
    content = content.replace('href="/truths"', 'href="/feeds"')

    # 3. Add "use client" at top if not present
    if not content.lstrip().startswith('"use client"'):
        content = '"use client";\n\n' + content

    return content


def main():
    os.makedirs(APP, exist_ok=True)
    created = []
    for src_name, dest_rel in MAPPING.items():
        src_path = os.path.join(SRC, src_name)
        dest_path = os.path.join(APP, dest_rel)
        with open(src_path, "r") as f:
            content = f.read()
        new_content = convert_content(src_name, content)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "w") as f:
            f.write(new_content)
        created.append(dest_path)
        print(f"Converted {src_name} -> {dest_path}")

    return created


if __name__ == "__main__":
    main()
