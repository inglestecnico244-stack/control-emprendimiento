# 🚀 MiControl: AI-Powered Entrepreneurship Management Suite

## Project Description
MiControl is a lightweight web application engineered to streamline business operations for small-scale merchants, specifically tailored for wine and white spirit distributors. By integrating a modular frontend architecture with cloud database persistence via Supabase and an integrated AI assistant, this tool empowers entrepreneurs to efficiently manage inventory, monitor product stock levels, track pricing margins, and generate data-driven business insights in real time.

## Typical Structure
The project repository is structured into distinct modular layers to ensure separation of concerns and maintainability:
- **`index.html`**: Serves as the primary structural interface, delivering a responsive dashboard layout with embedded modern UI styling.
- **`conexion.js`**: Manages asynchronous communication layers, handling remote database synchronization with Supabase and interfacing with AI services.
- **`repositorio.js`**: Implements core business logic, data validation rules, and real-time inventory metrics processing.
- **`app.js`**: Acts as the central event controller, orchestrating DOM manipulations and user interaction workflows.

## Installation Instructions
To set up and run a local development instance of this project, follow these sequential steps:
1. First, clone the repository from GitHub to your local machine:
   `git clone https://github.com/your-username/control-emprendimiento.git`
2. Next, open the project directory using Visual Studio Code.
3. Then, install a local development server extension (such as Live Server) to bypass browser security restrictions regarding local file protocols.
4. Finally, launch `index.html` via the local server to initialize the application interface.

## Usage
1. Navigate to the **Products** section using the sidebar menu.
2. Fill out the input form with your item details, ensuring you specify the product name, category (e.g., Wines & White Spirits), cost price, sale price, and initial stock.
3. Click the **Save Product** button to execute data insertion.
4. Monitor real-time dashboard metrics displaying total items and low-stock alerts.
5. Use the **AI Assistant** card to input queries or request automated promotional text generation for your inventory.

## Dependencies & Technologies
- **HTML5 & CSS3**: Semantic markup and custom styling using CSS Grid and Flexbox variables.
- **Vanilla JavaScript (ES6+)**: Asynchronous event handling, modular architecture, and DOM manipulation.
- **Supabase JavaScript SDK (`@supabase/supabase-js`)**: Cloud relational database connectivity (PostgreSQL) and serverless edge function execution.
- **Google Fonts (Inter)**: Modern typography rendering.

## License
This project is developed for educational purposes as part of the Technical English II curriculum at I.S.F.T. N° 244. Distributed under the MIT License.