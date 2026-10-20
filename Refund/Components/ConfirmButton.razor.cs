using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.FluentUI.AspNetCore.Components;

namespace Refund.Components;

/// <summary>A button whose action requires a second click in a confirmation popover.</summary>
public partial class ConfirmButton : ComponentBase
{
    // Keep FluentButton properties typed: unmatched Razor attributes are strings
    // unless the caller explicitly provides an expression.
    [Parameter] public string Id { get; set; } = $"confirm-{Guid.NewGuid():N}";
    [Parameter] public ButtonAppearance? Appearance { get; set; }
    [Parameter] public Icon? IconStart { get; set; }
    [Parameter] public Icon? IconEnd { get; set; }
    [Parameter] public bool Disabled { get; set; }
    [Parameter] public string? Class { get; set; }
    [Parameter] public string? Style { get; set; }
    [Parameter] public string? Title { get; set; }
    [Parameter] public string? Color { get; set; }
    [Parameter] public string? BackgroundColor { get; set; }
    [Parameter] public RenderFragment? ChildContent { get; set; }
    [Parameter] public EventCallback<MouseEventArgs> OnClick { get; set; }
    [Parameter(CaptureUnmatchedValues = true)] public IReadOnlyDictionary<string, object>? AdditionalAttributes { get; set; }

    private bool _confirmationOpen;

    private async Task HandleClick(MouseEventArgs e)
    {
        _confirmationOpen = false;
        await OnClick.InvokeAsync(e);
    }
}
