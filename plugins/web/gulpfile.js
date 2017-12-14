/* eslint global-require: off */
const gulp = require('gulp');
const less = require('gulp-less');
const cleanCSS = require('gulp-clean-css');

gulp.task('default', ['css']);

gulp.task('watch', () => {
  gulp.watch('client/less/**/*.less', ['css']);
});

gulp.task('css', () => gulp.src('client/less/*.less')
  .pipe(less())
  .pipe(cleanCSS())
  .pipe(gulp.dest('dist/less')));
