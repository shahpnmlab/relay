using Microsoft.FluentUI.AspNetCore.Components;
using Relay.MenuHarness;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddRazorComponents().AddInteractiveServerComponents();
builder.Services.AddFluentUIComponents();
var app = builder.Build();
app.UseAntiforgery();
app.UseStaticFiles(new StaticFileOptions { FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
    Path.GetFullPath("../../Relay/wwwroot", app.Environment.ContentRootPath)) });
app.MapStaticAssets();
app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
app.Run();
