using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.FluentUI.AspNetCore.Components;
using Microsoft.JSInterop;
using Refund.Components;

namespace Refund.Tests.Components;

public sealed class ConfirmButtonRenderingTests
{
    [Theory]
    [InlineData(ButtonAppearance.Transparent, "transparent")]
    [InlineData(ButtonAppearance.Subtle, "subtle")]
    [InlineData(ButtonAppearance.Primary, "primary")]
    public async Task AppearanceIsPassedToTheNativeButtonAsAnEnum(ButtonAppearance appearance, string attribute)
    {
        var html = await RenderAsync(new Dictionary<string, object?>
        {
            [nameof(ConfirmButton.Appearance)] = appearance,
            [nameof(ConfirmButton.Title)] = "Delete queue",
            [nameof(ConfirmButton.Disabled)] = false,
            [nameof(ConfirmButton.AdditionalAttributes)] = new Dictionary<string, object> { ["aria-label"] = "Delete queue" }
        });
        Assert.Contains($"appearance=\"{attribute}\"", html);
        Assert.Contains("aria-label=\"Delete queue\"", html);
    }

    [Fact]
    public async Task CallerSuppliedIdAlsoAnchorsTheConfirmation()
    {
        var html = await RenderAsync(new Dictionary<string, object?>
        {
            [nameof(ConfirmButton.Id)] = "delete-queue-42",
            [nameof(ConfirmButton.IconEnd)] = new Microsoft.FluentUI.AspNetCore.Components.Icons.Regular.Size20.Delete()
        }, openConfirmation: true);
        Assert.Contains("id=\"delete-queue-42\"", html);
        Assert.Contains("anchor-id=\"delete-queue-42\"", html);
        Assert.Contains("<svg", html);
    }

    private static async Task<string> RenderAsync(Dictionary<string, object?> parameters, bool openConfirmation = false)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddFluentUIComponents();
        services.AddSingleton<IJSRuntime, NoJsRuntime>();
        services.AddSingleton<IComponentActivator>(provider => new DependencyActivator(provider, openConfirmation));
        await using var provider = services.BuildServiceProvider();
        await using var renderer = new HtmlRenderer(provider, provider.GetRequiredService<ILoggerFactory>());
        return await renderer.Dispatcher.InvokeAsync(async () =>
        {
            var component = await renderer.RenderComponentAsync<ConfirmButton>(ParameterView.FromDictionary(parameters));
            return component.ToHtmlString();
        });
    }

    private sealed class DependencyActivator(IServiceProvider services, bool openConfirmation) : IComponentActivator
    {
        public IComponent CreateInstance(Type componentType)
        {
            var component = (IComponent)ActivatorUtilities.CreateInstance(services, componentType);
            if (openConfirmation && component is ConfirmButton)
                typeof(ConfirmButton).GetField("_confirmationOpen", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!
                    .SetValue(component, true);
            return component;
        }
    }

    private sealed class NoJsRuntime : IJSRuntime
    {
        public ValueTask<TValue> InvokeAsync<TValue>(string identifier, object?[]? args) =>
            throw new InvalidOperationException("Static rendering must not call JavaScript.");
        public ValueTask<TValue> InvokeAsync<TValue>(string identifier, CancellationToken cancellationToken, object?[]? args) =>
            InvokeAsync<TValue>(identifier, args);
    }
}
