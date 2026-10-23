using Refund.JobResources;
using Refund.Jobs.Fs.Import.ImportDataSetFs;

namespace Refund.Tests.Jobs;

[Collection("JobRegistry")]
public class ImportDataSetFsTests
{
    [Fact]
    public void DefaultGrouping_PreservesExistingGroupCount()
    {
        JobRegistry.EnsurePopulated();
        var job = new ImportDataSetFs { EerFrames = 57, EerGroupExposure = 0 };
        var dataSet = Assert.IsType<DataSetFs>(job.PortsOut["DataSet"].GetResource());

        Assert.Equal(EerGroupingMode.NumberOfGroups, dataSet.EerGrouping);
        Assert.Equal(-57, dataSet.ToOptionsWarp().Import.EERGroupFrames);
    }

    [Theory]
    [InlineData(40, 1, 40)]
    [InlineData(40, 1.5, 27)]
    [InlineData(40, 50, 1)]
    public void ExposureGrouping_PropagatesAndRoundsUp(double total, double perGroup, int expectedGroups)
    {
        JobRegistry.EnsurePopulated();
        var job = new ImportDataSetFs
        {
            EerGrouping = EerGroupingMode.GroupExposure,
            EerGroupExposure = (decimal)perGroup,
            OverallExposure = (decimal)total,
            EerFrames = 999
        };
        var dataSet = Assert.IsType<DataSetFs>(job.PortsOut["DataSet"].GetResource());

        Assert.Equal(job.EerGrouping, dataSet.EerGrouping);
        Assert.Equal(job.EerGroupExposure, dataSet.EerGroupExposure);
        Assert.Equal(-expectedGroups, dataSet.ToOptionsWarp().Import.EERGroupFrames);
        Assert.Equal(-(decimal)total, dataSet.ToOptionsWarp().Import.DosePerAngstromFrame);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void ExposureGrouping_RejectsNonpositiveExposure(int perGroup)
    {
        var dataSet = new DataSetFs
        {
            EerGrouping = EerGroupingMode.GroupExposure,
            EerGroupExposure = perGroup
        };

        Assert.Throws<ArgumentOutOfRangeException>(() => dataSet.ToOptionsWarp());
    }
}
