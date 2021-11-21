<template>
  <div
    v-if="isDataError"
    class="error"
    v-text="errorMessage"
  />
  <div v-else class="risk-review-container">
    <div class="titles-container" :style="titlesContainerStyle">
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
    <div ref="svgContainer" class="svg-container"/>
    <div class="legend-container">
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
  data: (self) => ({
    logSystem: self.$root.logSystem,
    eventSystem: self.$root.eventSystem,
    /** Chart technical data. */
    isDataError: false,
    errorMessage: '',
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
    titleColName: 'title',
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
  methods: {
    setDataset(data = []) {
      this.dataset = data;
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
        .attr('class', 'content')
        .append('g')
        .attr('transform', `translate(${this.marginX}, ${this.marginY})`);

      this.svg.append('rect')
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

      axis.selectAll('.tick text').each(function() {
        d3.select(this).attr('class', 'x-axis-tick-caption');
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
          fill = '#938FA0',
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
          .attr('width', d => Math.abs(xScale(d[id]) - xScale(0)));
      }
    },

    createLines() {
      const { xScale, yScale, barHeight, barParts } = this;
      for (const part of barParts) {
        const { id, type, fill = '#CD5D67', isTitleShow = true } = part;

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
  },
};
</script>

<style lang="sass">
@import ./styles/component
</style>
