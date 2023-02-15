<template>
  <div class="FGKRiskReview">
    <div v-if="isDataError" class="DataError">
      <span class="FontIcon name_infoCircleOutline Icon"></span>
      {{ errorMessage }}
    </div>
    <div v-show="!isDataError" class="titles-container" :style="titlesContainerStyle">
      <div
        v-for="(title, i) in titles"
        :key="`t-${i}`"
        class="bar-title"
        :style="{
          height: `${barHeight}px`,
          marginTop: `${i === 0 ? 0 : chartPaddingInner}px`
        }"
        v-text="title"
      />
    </div>
    <div v-show="!isDataError" ref="svgContainer" class="svg-container"/>
    <div v-show="!isDataError" class="legend-container">
      <div
        v-for="(part, i) in barParts"
        :key="`legend-${i}`"
        class="item"
      >
        <div class="mark" :style="{ backgroundColor: part.fill }"/>
        <div class="text" v-text="part.title"/>
      </div>
    </div>
  </div>
</template>

<script>
import defaultBarParts from './utils/defaultBarParts';

export default {
  name: 'PluginComponent',
  data: () => ({
    /** Chart technical data. */
    isDataError: false,
    errorMessage: '',
    dataAttr: '',
    svg: null,
    width: 0,
    height: 0,
    xScale: null,
    yScale: null,
    marginX: 15,
    marginY: 15,
    barHeight: 0,
    chartPaddingInner: 0,
    chartPaddingOuter: 0,
    /** Chart user config data. */
    titleColName: '',
    dataset: [],
    barParts: defaultBarParts,
  }),
  computed: {
    titlesContainerStyle() {
      const { chartPaddingOuter, marginY } = this;
      return { paddingTop: `${chartPaddingOuter + marginY}px` };
    },

    titles() {
      return this.dataset.map(ds => ds[this.titleColName]);
    },
  },
  mounted() {
    const { svgContainer } = this.$refs;
    const attrs = svgContainer.getAttributeNames();
    /** Used to support scoped styles. */
    this.dataAttr = attrs.find(attr => attr.startsWith('data-'));
    this.render();
    this.$root.$on('resize', this.onResize);
  },
  methods: {
    setDataset(data = []) {
      this.dataset = data;
    },

    setTitleColName(name = '') {
      this.titleColName = name;
      this.render();
    },

    setBarParts(barParts){
      this.barParts = barParts;
      this.render();
    },

    setError(text = '', show = false) {
      this.errorMessage = text;
      this.isDataError = show;
    },

    render() {
      const { isValid, error } = this.validateData();

      if (!isValid) {
        return this.setError(error, true);
      }

      this.setError('', false);
      this.$nextTick(() => {
        this.clearSvgContainer();
        this.prepareRenderData();
        this.createAxisX();
        this.createBars();
        this.createLines();
      });
    },

    validateData() {
      const { dataset, barParts } = this;

      if (dataset.length <= 0) {
        return { isValid: false, error: 'Нет данных для построения' };
      }

      if (barParts.length <= 0) {
        return { isValid: false, error: 'Не указаны части столбцов' };
      }

      const dsCols = Object.keys(dataset[0]);

      for (const id of barParts.map(p => p.id)) {
        if (!dsCols.includes(id)) {
          return { isValid: false, error: `Отсутствует столбец данных "${id}"` };
        }
      }

      return { isValid: true, error: '' };
    },

    clearSvgContainer() {
      d3.select(this.$refs.svgContainer).select('svg').remove();
    },

    prepareRenderData() {
      const { svgContainer } = this.$refs;
      const { offsetWidth, offsetHeight } = svgContainer;

      this.width = offsetWidth - this.marginX * 2;
      this.height = offsetHeight - this.marginY * 2;

      this.svg = d3.select(svgContainer)
        .append('svg')
        .attr(this.dataAttr, '')
        .attr('class', 'content')
        .append('g')
        .attr('transform', `translate(${this.marginX}, ${this.marginY})`);

      this.svg.append('rect')
        .attr(this.dataAttr, '')
        .attr('class', 'chart-back')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', this.width)
        .attr('height', this.height)

      const extent = [];

      this.barParts.forEach(part => {
        this.dataset.forEach(ds => {
          extent.push(ds[part.id])
        })
      })

      const xDomain = d3.extent(extent);

      this.xScale = d3.scaleLinear()
        .range([35, this.width - 35])
        .domain(d3.extent(xDomain));

      const padInner = 0.3;
      const padOuter = 0.7;

      this.yScale = d3.scaleBand()
        .range([0, this.height])
        .domain(this.dataset.map((b, i) => i))
        .paddingInner(padInner)
        .paddingOuter(padOuter);

      this.barHeight = this.yScale.bandwidth();
      this.chartPaddingInner = this.yScale.step() * padInner;
      this.chartPaddingOuter = this.yScale.step() * padOuter;
    },

    createAxisX() {
      const axis = this.svg
        .append('g')
        .call(d3.axisBottom(this.xScale));

      axis.selectAll('.tick line').each(function() {
        d3.select(this).remove();
      });

      const dataAttr = this.dataAttr;

      axis.selectAll('.tick text').each(function() {
        d3.select(this).attr(dataAttr, '').attr('class', 'x-axis-tick-caption');
      });

      axis.select('.domain').remove();
    },

    createBars() {
      const { xScale, yScale, barHeight, barParts } = this;
      const halfBarHeight = barHeight / 2;

      for (const part of barParts) {
        const { id, type } = part;

        if (type !== 'bar') continue;

        const {
          fill = 'var(--text_secondary)',
          isTitleShow = false,
          isFullHeight = true,
        } = part;

        const height = isFullHeight ? barHeight : halfBarHeight;

        this.svg.selectAll()
          .data(this.dataset)
          .enter()
          .append('rect')
          .attr('x', d => xScale(Math.min(0, d[id])))
          .attr('y', (d, i) => {
            const y = yScale(i);

            if (isTitleShow) {
              const xData = d[id];
              const x = xScale(xData);
              const xAttr = xData >= 0 ? x + 10 : x - 10;
              const yAttr = y + barHeight / 2;
              const anchor = xData >= 0 ? 'start' : 'end';
              this.svg.append('text')
                .text(xData)
                .attr(this.dataAttr, '')
                .attr('class', 'bar-text-caption')
                .attr('fill', fill)
                .attr('text-anchor', anchor)
                .attr('x', xAttr)
                .attr('y', yAttr)
                .attr('dy', function() {
                  const textHeight = this.getBBox().height;
                  return textHeight / 3;
                });
            }

            return isFullHeight ? y : y + height / 2;
          })
          .attr('fill', fill)
          .attr('height', height)
          .attr('width', d => {
            const width = Math.abs(xScale(d[id]) - xScale(0));
            return isNaN(width) ? 0 : width;
          })
          .on('click', (event, d) => {
              this.$root.publishEventClicked(d);
          });
      }
    },

    createLines() {
      const { xScale, yScale, barHeight, barParts } = this;
      for (const part of barParts) {
        const { id, type, fill = 'var(--pink)', isTitleShow = true } = part;

        if (type !== 'line') continue;

        this.dataset.forEach((bar, i) => {
          const value = bar[id];
          const x = xScale(value);
          const y = yScale(i);
          const line = d3.line();

          this.svg.append('path')
            .attr('stroke', fill)
            .attr('stroke-width', 3)
            .attr('d', line([[x, y - 5], [x, y + barHeight + 5]]));

          if (isTitleShow) {
            this.svg.append('text')
              .text(value)
              .attr(this.dataAttr, '')
              .attr('class', 'bar-text-caption')
              .attr('fill', fill)
              .attr('text-anchor', 'end')
              .attr('x', x - 5)
              .attr('y', y + barHeight / 2)
              .attr('dy', function() {
                const textHeight = this.getBBox().height;
                return textHeight / 3;
              });
          }
        });
      }
    },

    onResize() {
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = setTimeout(() => {
        this.render();
        this.resizeTimeout = null;
      }, 50);
    },
  },
};
</script>

<style lang="sass" scoped>
*
  box-sizing: border-box
  margin: 0
  padding: 0

.FGKRiskReview
  width: 100%
  height: 100%
  display: flex
  font-family: 'Proxima Nova', serif
  position: relative

  .DataError
    position: absolute
    display: flex
    width: 100%
    height: 100%
    align-items: center
    justify-content: center
    flex-direction: column
    color: var(--text_secondary)
    background-color: var(--background_main)

    .Icon
      color: var(--border_secondary)
      font-size: 100px
      margin-bottom: 8px

  .titles-container
    color: var(--text_main)
    font-size: 15px

    .bar-title
      display: flex
      align-items: center
      padding-left: 16px
      line-height: 18px

  .legend-container
    display: flex
    flex-direction: column
    justify-content: center

    .item
      display: flex
      align-items: center
      color: var(--text_main)
      font-size: 15px
      line-height: 18px

      &:not(:last-child)
        margin-bottom: 20px

      .mark
        flex-shrink: 0
        min-width: 18px
        height: 18px

      .text
        padding-left: 10px
        padding-right: 16px

  .svg-container
    width: 100%
    overflow: hidden

    .content
      width: 100%
      height: 100%

      .chart-back
        fill: var(--border_12)

      .x-axis-tick-caption
        fill: var(--text_secondary)
        font-size: 13px
        font-weight: 600
        text-anchor: middle

      .bar-text-caption
        font-size: 15px
        font-weight: 600
</style>
