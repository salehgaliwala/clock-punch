import asyncio
from playwright.async_api import async_playwright
import datetime
import json

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

        today = datetime.datetime.now().isoformat() + "Z"

        mock_data = {
            "status": "success",
            "users": [
                {"id": "1", "name": "Alice Admin", "pin": "1234", "role": "admin"},
                {"id": "2", "name": "Bob Employee", "pin": "5678", "role": "user"}
            ],
            "projects": [
                {"id": "p1", "name": "Project A", "status": "active"},
                {"id": "p2", "name": "Project B", "status": "active"}
            ],
            "entries": [
                {"id": "e1", "userId": "1", "project": "Project A", "type": "IN", "timestamp": today},
                {"id": "e2", "userId": "2", "project": "Project B", "type": "IN", "timestamp": today}
            ]
        }
        mock_body = json.dumps(mock_data)

        await page.route("**/macros/s/**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=mock_body
        ))

        await page.goto("http://localhost:5173")

        # Wait for indicators to appear
        await page.wait_for_selector(".indicator-avatar", timeout=10000)

        # Take a screenshot to verify placement
        await page.screenshot(path="verification/screenshots/final_result.png")
        print("Captured verification/screenshots/final_result.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
