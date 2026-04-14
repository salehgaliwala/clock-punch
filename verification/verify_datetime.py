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

        # Setup mock data with one entry to edit
        mock_data = {
            "status": "success",
            "users": [{"id": "1", "name": "Alice Admin", "pin": "1234", "role": "admin"}],
            "projects": [{"id": "p1", "name": "Project A", "status": "active"}],
            "entries": [{"id": "e1", "userId": "1", "project": "Project A", "type": "IN", "timestamp": "2024-05-15T10:00:00Z"}]
        }

        await page.route("**/macros/s/**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(mock_data)
        ))

        await page.goto("http://localhost:5173")

        # Open Admin via Settings (requires PIN 1234)
        await page.click("svg.lucide-settings")
        # Enter PIN
        for digit in "1234":
            await page.click(f"button.pin-btn:has-text('{digit}')")

        # Wait for Admin Panel
        await page.wait_for_selector(".admin-container")

        # Go to Entries tab
        await page.click("div.admin-tab:has-text('Entries')")

        # Click Edit on the entry
        await page.click(".admin-btn-primary")

        # Verify the input type is datetime-local
        input_type = await page.get_attribute("input[type='datetime-local']", "type")
        print(f"Input type verified: {input_type}")

        # Take a screenshot
        await page.screenshot(path="verification/screenshots/admin_edit_datetime.png")
        print("Captured verification/screenshots/admin_edit_datetime.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
