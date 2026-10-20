using Microsoft.AspNetCore.Components;
using Microsoft.FluentUI.AspNetCore.Components;
using Refund.Components;

namespace Refund.UIFields;

/// <summary>
/// Base component class for all UI field view components that render job parameters in the UI.
/// Provides common parameters and functionality needed by all field types, enabling consistent
/// editing experience and a clean separation between field data and its visual representation.
/// </summary>
public abstract class UiFieldViewBase : BufferedInputBase<object>
{
    /// <summary>Order an explicit reset after in-flight edits so an older save cannot undo it.</summary>
    public Task ResetValueAsync() => IsDisabled ? Task.CompletedTask : SetValueAsync(DefaultValue);

    [Parameter] public string Class { get; set; }

    /// <summary>
    /// The field attribute metadata that describes how this field should be displayed
    /// </summary>
    [Parameter]
    public virtual UiFieldBase FieldDescription { get; set; }
    
    /// <summary>
    /// The default value to use when no value is provided or when resetting to defaults
    /// </summary>
    [Parameter]
    public virtual object DefaultValue { get; set; }
    
    /// <summary>
    /// Additional data that can be passed to the field view for rendering or processing
    /// </summary>
    [Parameter]
    public virtual object AdditionalData { get; set; }

    /// <summary>
    /// Error message to display if the current value is invalid
    /// </summary>
    [Parameter]
    public virtual string Error { get; set; }

    /// <summary>
    /// Gets or sets whether this field should be rendered in a disabled/read-only state
    /// </summary>
    /// <remarks>
    /// When true, the field will disable all interactive elements while maintaining
    /// the same visual layout as the editable version.
    /// </remarks>
    [Parameter]
    public virtual bool IsDisabled { get; set; } = false;
}
